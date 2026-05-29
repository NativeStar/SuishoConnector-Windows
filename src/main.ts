import { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } from "electron";
import path from "path";
import fs from "fs-extra";
import type PhoneServerType from "./modules/Server";
import Util from "./modules/Util";
import type DownloadServerType from "./modules/DownloadServer";
import { Logger, LogLevel } from "./modules/Logger";
import type ManualConnectType from "./modules/ManualConnect";
import type BroadcasterType from "./modules/Broadcaster";
import ConnectionCloseCode from "./enum/ConnectionCloseCode";
import type ApkDownloadServer from "./modules/ApkServer";
import configTemplate from "./constant/configTemplate";
import { enableCompileCache } from "node:module";
import { registerStartupIpcHandles, registerConnectedIpcHandles } from "./modules/IpcHandles";
let connectedDevice: PhoneServerType;
/**
 * @description 连接手机窗口
*/
let connectPhoneWindow: BrowserWindow;
/**
 * @description 主操作窗口
*/
let mainWindow: BrowserWindow | null = null;
//SSL证书下载服务器实例
let certDownloadServer: DownloadServerType | null = null;
//手动连接中转服务器
let manualConnectRedirectServer: ManualConnectType | null = null;
//udp广播 自动连接
let broadcaster: BroadcasterType | null = null;
let apkDownloadServerInstance: ApkDownloadServer | null = null;
/* 
如果不这么搞触发will-download回调内读取的文件名永远是第一次触发的文件名
*/
enableCompileCache(`${path.resolve(`${app.getPath("userData")}/programData/oat/`)}`);
//阻止多实例
if (!app.requestSingleInstanceLock()) {
    //还没初始化日志模块 没必要输出
    app.exit(0);
}
//阻止媒体控制
app.commandLine.appendSwitch('disable-features', 'MediaSessionService,HardwareMediaKeyHandling');
Menu.setApplicationMenu(null);
process.on("uncaughtException", (error, origin) => Util.onUncaughtException(error, origin, mainWindow))
process.on("unhandledRejection", (reason, promise) => {
    logger.writeError(`Unhandled rejection at: ${promise} reason: ${reason}`);
    Util.onUncaughtException(reason as Error, "unhandledRejection", mainWindow)
});
app.on("ready", async (_event, _info) => {
    global.logger = new Logger(`${app.getPath("userData")}/programData/logs`);
    //检查并获取配置文件
    global.config = await Util.loadConfig();
    await Util.updateConfig();
    global.logger.setLevel(Reflect.get(LogLevel, config.logLevel));
    registerStartupIpcHandles();
    app.setAppUserModelId(app.isPackaged ? "com.suisho.connector" : process.execPath);
    connectPhoneWindow = new BrowserWindow({
        titleBarStyle: "hidden",
        center: true,
        title: "Suisho Connector Main Window",
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        titleBarOverlay: {
            height: 40,
            color: nativeTheme.shouldUseDarkColors ? "#1d1b1e" : "#fdf7fe",
            symbolColor: nativeTheme.shouldUseDarkColors ? "#fdf7fe" : "#1d1b1e"
        },
        width: 330,
        height: 600,
        alwaysOnTop: config.windowAlwaysOnTop,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload/connectPhonePreload.js")
        }
    });
    //阻止拖动区域右键菜单
    connectPhoneWindow.hookWindowMessage(278, () => {
        connectPhoneWindow.setEnabled(false);
        setTimeout(() => {
            connectPhoneWindow.setEnabled(true);
        }, 50);
    });
    connectPhoneWindow.on("ready-to-show", async () => {
        connectPhoneWindow.setMaximizable(false);
        logger.writeInfo("Connect phone window created");
        app.setName("Suisho Connector");
    });
    connectPhoneWindow.setContentProtection(global.config.enableContentProtection);
    app.isPackaged ? connectPhoneWindow.loadFile("./dist/renderer/index.html", { hash: "connect-phone" }) : connectPhoneWindow.loadURL("http://localhost:5173/#/connect-phone");
    //还没连接设备就拖动上传文件
    const lastArg = process.argv[process.argv.length - 1] ?? null;
    if (app.isPackaged && lastArg !== process.execPath && await fs.exists(lastArg)) {
        dialog.showMessageBox({
            type: "info",
            message: "你需要先连接设备才能进行此操作"
        });
    }
    //一些不急的初始化
    setImmediate(() => {
        app.setAsDefaultProtocolClient("suisho", process.execPath, [app.getAppPath()]);
        //开控制台
        ipcMain.handle("openConsole", (event) => {
            //仅允许调试模式
            if (!Util.isDeveloping) return
            //如果未开启则打开 否则置于前台
            if (event.sender.isDevToolsOpened()) {
                logger.writeDebug("Devtools request focus")
                event.sender.devToolsWebContents?.focus();
                return
            }
            logger.writeInfo("Open devtools")
            event.sender.openDevTools({ mode: 'undocked' })
        });
        //深色模式适配
        nativeTheme.addListener("updated", () => {
            logger.writeInfo(`Native theme updated to:${nativeTheme.shouldUseDarkColors ? "dark" : "light"}`);
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                browserWindow.setTitleBarOverlay({
                    height: 40,
                    color: nativeTheme.shouldUseDarkColors ? "#1d1b1e" : "#fdf7fe",
                    symbolColor: nativeTheme.shouldUseDarkColors ? "#fdf7fe" : "#1d1b1e"
                })
            }
        });
        //阻止多开
        app.on("second-instance", async (_event, args, _dir, _data) => {
            //主窗口
            if (mainWindow != null && !mainWindow?.isDestroyed()) {
                logger.writeDebug("Restore main window because of second instance");
                mainWindow.setAlwaysOnTop(true);
                if (mainWindow.isMinimized()) mainWindow?.restore();
                mainWindow?.show();
                mainWindow?.focus();
                mainWindow.setAlwaysOnTop(false);
                mainWindow.flashFrame(false);
                const lastArg = args[args.length - 1];
                // console.log(lastArg);
                if (lastArg != null && await fs.exists(lastArg)) {
                    logger.writeDebug("Transmit drag item to app icon");
                    const fileStat = await fs.stat(lastArg);
                    if (fileStat.isFile()) {
                        logger.writeInfo(`Transmit file from drag app icon:${lastArg}`);
                        mainWindow?.webContents.send("webviewEvent", "transmitDragFile", { filename: path.basename(lastArg), filePath: lastArg, size: fileStat.size });
                    } else if (fileStat.isDirectory()) {
                        mainWindow.webContents.send("webviewEvent", "showAlert", { title: "上传文件失败", content: "暂仅支持通过拖入互传窗口处理文件夹" });
                    }
                }
            } else if (connectPhoneWindow != null && !connectPhoneWindow.isDestroyed()) {
                //连接窗口
                logger.writeDebug("Restore connect window because of second instance");
                connectPhoneWindow.restore();
                connectPhoneWindow.show();
                connectPhoneWindow.focus();
            }
            for (const argString of args) {
                if (argString.startsWith("suisho:")) {
                    logger.writeDebug(`Handle protocol in second instance:${argString}`);
                    if (argString.endsWith("clickNotification")) {
                        connectedDevice?.notificationCore?.onNotificationClick();
                    }
                    return
                }
            }
        });
    })
});
//ipc
ipcMain.handleOnce("connectPhone_initServer", async (_event) => {
    let networkDriverName = "";
    await Util.ensureCert();
    const { default: PhoneServer } = (await import("./modules/Server.js")).default;
    const { default: ManualConnect } = ((await import("./modules/ManualConnect.js"))).default;
    const { init: trayInit } = (await import("./modules/Tray.js"))
    connectedDevice = new PhoneServer(connectPhoneWindow, {
        openMainWindow: async () => {
            logger.writeDebug("Invoke open main window");
            if (!connectPhoneWindow.isDestroyed()) connectPhoneWindow.close();
            mainWindow = new BrowserWindow({
                center: true,
                titleBarStyle: "hidden",
                title: `Suisho Connector:${global.clientMetadata.model}`,
                resizable: false,
                fullscreenable: true,
                autoHideMenuBar: true,
                frame: false,
                alwaysOnTop: config.windowAlwaysOnTop,
                titleBarOverlay: {
                    height: 40,
                    color: nativeTheme.shouldUseDarkColors ? "#1d1b1e" : "#fdf7fe",
                    symbolColor: nativeTheme.shouldUseDarkColors ? "#fdf7fe" : "#1d1b1e"
                },
                opacity: config.windowOpacity ? config.windowOpacity / 100 : 1,
                // width: 850,
                // height: 650,
                show: false,
                webPreferences: {
                    webSecurity: app.isPackaged,
                    spellcheck: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload/mainPreload.js'),
                    disableHtmlFullscreenWindowResize: true
                }
            });
            await registerConnectedIpcHandles(connectedDevice, mainWindow);
            // 隐藏窗口右键菜单
            mainWindow.hookWindowMessage(278, () => {
                mainWindow?.setEnabled(false);
                setTimeout(() => {
                    mainWindow?.setEnabled(true);
                }, 50);
            });
            mainWindow.on("ready-to-show", () => {
                mainWindow?.setMaximizable(false);
                connectedDevice.setWindow(<BrowserWindow>mainWindow);
                import("./modules/FileWatcher.mjs").then(watcherModule => {
                    const watcherInstance = new watcherModule.FileWatcher(connectedDevice.responseManager!, mainWindow!);
                    watcherInstance.init(global.deviceConfig.getConfigProp<string[]>("fileSyncTargetDirectory", []));
                })
                //尝试修复窗口不显示
                mainWindow?.show();
                trayInit(mainWindow!, connectedDevice);
                setTimeout(() => {
                    connectedDevice.socket?.send(JSON.stringify({ packetType: "main_server_initialled" }));
                }, 150);
                logger.writeInfo("Opened main window");
            });
            app.isPackaged ? mainWindow.loadFile("./dist/renderer/index.html", { hash: "home" }) : mainWindow.loadURL("http://localhost:5173/#/home");
            mainWindow.setContentProtection(global.config.enableContentProtection);
            mainWindow.on("closed", () => {
                mainWindow = null;
            });
            mainWindow.on("close", (event) => {
                //断开连接后关闭窗口不保留后台
                if (connectedDevice.isClosed) {
                    logger.writeInfo("Close application by main window closed");
                    mainWindow?.destroy();
                    app.quit();
                    return
                }
                event.preventDefault();
                mainWindow?.hide();
                logger.writeDebug("Hide main window by user close");
            });
            mainWindow.webContents.setWindowOpenHandler(() => { return { action: "deny" } });
            // 鉴权sessionId 文件管理功能用
            mainWindow.webContents.session.cookies.set({
                name: "sessionId",
                value: global.clientMetadata.sessionId,
                url: `https://${connectedDevice.getPhoneAddress()}`,
                sameSite: "no_restriction",
            });
            //不走代理
            mainWindow.webContents.session.setProxy({ mode: "direct" });
            //关机提醒
            mainWindow.on("query-session-end", (e) => {
                if (e.reasons.includes("shutdown") || e.reasons.includes("logoff")) {
                    import("./constant/CloseCodeReasonString.js").then(v => {
                        const CloseReason = v.default.default
                        connectedDevice.socket?.close(ConnectionCloseCode.ComputerWillShutdown, CloseReason[ConnectionCloseCode.ComputerWillShutdown])
                    })
                }
            });
            //视频全屏
            mainWindow.on("enter-html-full-screen", () => {
                mainWindow?.setResizable(true);
                mainWindow?.setFullScreen(true);
            });
            mainWindow.on("leave-html-full-screen", () => {
                mainWindow?.setFullScreen(false);
                mainWindow?.setResizable(false);
            });
            //关闭和发起连接有关的服务
            certDownloadServer?.close();
            certDownloadServer = null;
            manualConnectRedirectServer?.close();
            manualConnectRedirectServer = null;
            broadcaster?.close();
            broadcaster = null;
            apkDownloadServerInstance?.close();
            //锁屏监听
            import("electron").then(obj => {
                const powerMonitor = obj.powerMonitor;
                powerMonitor.on("lock-screen", () => {
                    mainWindow?.webContents.send("webviewEvent", "lockScreen")
                })
            })
            //保存本次连接数据
            global.config["internal:lastConnectionAddress"] = global.serverAddress ?? ""
            global.config["internal:lastConnectionName"] = networkDriverName
            //连接的设备就是绑定设备 更新自动连接单播地址
            if (global.config.boundDeviceId === global.clientMetadata.androidId) {
                global.config["internal:boundDeviceAddress"] = connectedDevice.getPhoneAddress();
                logger.writeInfo("Updated bound device unicast address");
            }
            logger.writeDebug("Saved last connection data");
            Util.saveConfig();
        }
    });
    //SSL证书下载服务器
    if (certDownloadServer === null) {
        const { default: DownloadServer } = (await import("./modules/DownloadServer.js")).default
        certDownloadServer = new DownloadServer(`${path.resolve(`${app.getPath("userData")}/programData/cert/certs.pak`)}`, 6735, "SSLCertDownload", connectedDevice.pairToken);
        await certDownloadServer.init();
        logger.writeInfo(`Cert download server started at port:${certDownloadServer.serverPort}`);
    } else {
        logger.writeDebug("Skipped download server init")
    }
    const serverPort = await connectedDevice.getPortAsync();
    //手动连接服务
    manualConnectRedirectServer = new ManualConnect(serverPort, certDownloadServer.serverPort, global.config.deviceId, connectedDevice.pairToken);
    manualConnectRedirectServer.init();
    const os = await import("os");
    const networkInterfaces = os.networkInterfaces();
    logger.writeInfo(`Network interfaces:${Reflect.ownKeys(networkInterfaces)}`);
    const networkInfo = await Util.getIPAddress(networkInterfaces)
    global.serverAddress = networkInfo.address
    networkDriverName = networkInfo.name ?? "";
    //将服务器地址打进全局
    logger.writeInfo(`Local address is ${global.serverAddress}`);
    return {
        address: global.serverAddress,
        port: serverPort,
        certDownloadPort: certDownloadServer.serverPort,
        id: global.config.deviceId,
        token: connectedDevice.pairToken,
        pairCode: manualConnectRedirectServer.pairCode
    }
});
//写入配置
ipcMain.handle("main_setConfig", (_event, prop: string, value: string | number | boolean | null) => {
    if (!Object.hasOwn(configTemplate, prop)) {
        logger.writeWarn(`Set config ${prop} not found`);
        return
    }
    Reflect.set(global.config, prop, value);
    //保存配置
    Util.saveConfig();
    logger.writeDebug(`Set config ${prop} to ${value}`);
    //对防录屏配置的处理 即时生效
    //如果未来需要即时生效的配置增加则独立出去
    onApplicationConfigChange(prop, value);
});
//局域网扫描绑定设备
ipcMain.on("main_startAutoConnectBroadcast", (event) => {
    const sender = event.sender;
    //开始广播
    if (!global.config.boundDeviceKey) {
        // 有设备id但找不到key
        logger.writeWarn("Device key not found", "Auto Connector");
        sender.send("main_autoConnectError");
        return
    }
    import("./modules/Broadcaster.js").then(obj => {
        const Broadcaster = obj.default.default;
        broadcaster = new Broadcaster(global.config.boundDeviceId as any, sender);
        broadcaster.start();
        logger.writeInfo("Start auto connect broadcast")
    });
});

//开启apk下载服务器
ipcMain.handle("main_startApkDownloadServer", async () => {
    if (!apkDownloadServerInstance) {
        const apkDownloadModule = (await import("./modules/ApkServer.js")).default
        apkDownloadServerInstance = new apkDownloadModule.default();
        apkDownloadServerInstance.start();
        logger.writeInfo("Start apk download server")
    }
});
function onApplicationConfigChange(prop: string, value: string | boolean | number | null) {
    switch (prop) {
        case "enableContentProtection":
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                browserWindow.setContentProtection(value as boolean);
            }
            logger.writeInfo(`${value ? "enabled" : "disabled"} content protection`);
            break;
        case "windowAlwaysOnTop":
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                browserWindow.setAlwaysOnTop(value as boolean);
            }
            logger.writeInfo(`${value ? "enabled" : "disabled"} windows always on top`);
            break
        case "enableFileContextMenu":
            const newValue = value as boolean;
            if (newValue) {
                Util.registerContextMenu()
            } else {
                Util.unregisterContextMenu()
            }
            break
        case "boundDeviceId":
            if (value !== null) {
                global.config['internal:boundDeviceAddress'] = connectedDevice.getPhoneAddress();
            } else {
                global.config["internal:boundDeviceAddress"] = "";
            }
            Util.saveConfig();
            break
        case "windowOpacity":
            const fixedOpacity = value as number / 100
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                browserWindow.setOpacity(fixedOpacity);
            }
            logger.writeInfo(`Set window opacity to ${fixedOpacity}`);
            break;
        default:
            break;
    }
}