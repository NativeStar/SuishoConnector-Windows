import { app, BrowserWindow, ipcMain, dialog, shell, type Tray as TrayType, nativeImage, Menu, type MessageBoxOptions, nativeTheme, MenuItem } from "electron";
import path from "path";
import { X509Certificate } from "crypto"
import fs from "fs-extra";
import type PhoneServerType from "./modules/Server";
import Util from "./modules/Util";
import type DownloadServerType from "./modules/DownloadServer";
import type { Config as TypeConfig } from "./modules/Util"
import { Logger, LogLevel } from "./modules/Logger";
import type ManualConnectType from "./modules/ManualConnect";
import type OAuthService from "./modules/OAuthService";
import type DeviceConfig from "./modules/DeviceConfig";
import type BroadcasterType from "./modules/Broadcaster";
import { RightClickMenuItemId, type RightClickMenuItem } from "shared/const/RightClickMenuItems"
import ConnectionCloseCode from "./enum/ConnectionCloseCode";
import type ApkDownloadServer from "./modules/ApkServer";
import configTemplate from "./constant/configTemplate";
import { enableCompileCache } from "node:module";
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
let oauthService: OAuthService | null = null;
//udp广播 自动连接
let broadcaster: BroadcasterType | null = null;
let apkDownloadServerInstance: ApkDownloadServer | null = null;
let phoneFileDownloadWindow: BrowserWindow | null = null;
/* 
如果不这么搞触发will-download回调内读取的文件名永远是第一次触发的文件名
*/
let phoneFileDownloadPathTemp: string = "";
let trayInstance: TrayType | null = null;
let localCertFingerprint256: string | null = null;
const cacheFilesList = new Set<string>();
declare global {
    var logger: Logger
    var config: TypeConfig
    var deviceConfig: DeviceConfig
}
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
    let trayInitd = false;
    let networkDriverName = "";
    await Util.ensureCert();
    const { default: PhoneServer } = (await import("./modules/Server.js")).default;
    const { default: ManualConnect } = ((await import("./modules/ManualConnect.js"))).default;
    connectedDevice = new PhoneServer(connectPhoneWindow, {
        openMainWindow: () => {
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
                opacity: config.windowOpacity?config.windowOpacity/100:1,
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
                if (!trayInitd) {
                    initTray();
                    trayInitd = true;
                }
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
        },
        getTrayInstance() {
            return trayInstance;
        },
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
async function initTray() {
    //创建托盘图标
    const trayImage: Electron.NativeImage = nativeImage.createFromPath(path.join(app.getAppPath(), "res", "icon.ico"));
    const Tray = (await import("electron")).Tray;
    trayInstance = new Tray(trayImage);
    trayInstance.setTitle("Suisho Connector");
    trayInstance.setToolTip("Suisho Connector");
    trayInstance.addListener("double-click", () => {
        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            logger.writeDebug("Show main window by tray double click");
            mainWindow.show();
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    })
    const trayMenu: Electron.MenuItemConstructorOptions[] = [
        {
            label: "打开互传文件夹", click: () => {
                const dir = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`;
                //防止首次连接还没有目录时打开报错
                if (!fs.existsSync(dir)) {
                    fs.ensureDirSync(dir);
                }
                shell.openPath(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`.replaceAll("/", "\\"));
                logger.writeInfo(`Open folder in exploder(tray):${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`)
            }
        },
        {
            type: "separator"
        },
        {
            label: "重启应用",
            click: () => {
                if (connectedDevice.isClosed) {
                    mainWindow?.destroy();
                    app.relaunch()
                    app.quit();
                    return
                }
                mainWindow?.webContents.send("webviewEvent", "rebootConfirm");
                if (mainWindow?.isMinimized()) {
                    logger.writeDebug("Restore main window from reboot confirm")
                    mainWindow.restore()
                } else {
                    logger.writeDebug("Show main window from reboot confirm")
                    mainWindow?.show();
                }
            }
        },
        {
            label: "退出",
            click: () => {
                if (connectedDevice.isClosed) {
                    mainWindow?.destroy()
                    app.quit();
                    return
                }
                mainWindow?.webContents.send("webviewEvent", "closeConfirm");
                if (mainWindow?.isMinimized()) {
                    logger.writeDebug("Restore main window from close confirm")
                    mainWindow.restore()
                } else {
                    logger.writeDebug("Show main window from close confirm")
                    mainWindow?.show();
                }
            }
        }
    ];
    if (Util.isDeveloping) {
        trayMenu.push({
            label: "调试功能",
            submenu: [
                {
                    label: "打开调试工具",
                    click: () => {
                        const allWindows: BrowserWindow[] = BrowserWindow.getAllWindows();
                        allWindows[0].webContents.openDevTools();
                    }
                }
            ]
        },)
    }
    trayInstance.setContextMenu(Menu.buildFromTemplate(trayMenu));
}
//是否开发模式
ipcMain.handle("isDeveloping", _event => {
    return Util.isDeveloping;
});
//返回基础信息
ipcMain.handle('main_getDeviceBaseInfo', _event => {
    //调用两次不算bug 一次主页一次数据库
    logger.writeDebug(`connected device base info:${global.clientMetadata}`);
    return global.clientMetadata
});
//获取用户文件夹
ipcMain.handle("main_getUserPath", () => {
    logger.writeDebug(`Return user path:${app.getPath("userData")}`);
    return app.getPath("userData");
});
//使用资源管理器打开文件或文件夹
ipcMain.handle("main_openInExplorer", (_event, type, filePath) => {
    switch (type) {
        //互传文件文件夹
        case "transmitFolder":
            const dir = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`;
            //防止首次连接还没有目录时打开报错
            if (!fs.existsSync(dir)) {
                logger.writeInfo(`Create folder:${dir}`);
                fs.ensureDirSync(dir);
            }
            shell.openPath(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`.replaceAll("/", "\\"));
            logger.writeInfo(`Open folder in exploder:${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`)
            break
        case "transmitFile":
            const basePathName = path.basename(filePath);
            if (!fs.existsSync(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${basePathName}`)) {
                logger.writeInfo(`Request open in Exploder file not found:${basePathName}`);
                return false;
            }
            shell.showItemInFolder(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${basePathName}`.replaceAll("/", "\\"));
            logger.writeDebug(`Show file in exploder:{app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${basePathName}`);
            return true;
    }
});
//获取互传文件路径
ipcMain.handle("transmit_getTransmitFilePath", (_event, file) => {
    logger.writeDebug(`Generate file URL:file://${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${file}`);
    return `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${path.basename(file)}`.replaceAll("\\", "/");
});
ipcMain.handle("transmit_startTransmitDragFile", async (event, file) => {
    logger.writeDebug(`Start transmit drag file:${file}`);
    const filePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${path.basename(file)}`
    if (!await fs.exists(filePath)) return false;
    event.sender.startDrag({
        file: filePath,
        icon: nativeImage.createFromPath(path.join(app.getAppPath(), "res", "fileDrag.png"))
    });
    return true
})
ipcMain.handle("main_shellOpenFile", async (_event, file) => {
    const filePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${path.basename(file)}`.replaceAll("/", "\\");
    //检查文件存在
    if (await fs.exists(filePath)) {
        //存在
        shell.openPath(filePath);
        logger.writeInfo(`Open file:${filePath}`)
        return true;
    }
    logger.writeInfo(`Open file:${filePath} not exist`)
    return false;

})
//重启程序
ipcMain.on("reboot_application", async (_event, clearConnectionCache = false): Promise<void> => {
    logger.writeInfo("Reboot application");
    if (clearConnectionCache) {
        //清除缓存连接数据
        global.config["internal:lastConnectionAddress"] = ""
        global.config["internal:lastConnectionName"] = ""
        logger.writeDebug("Cleared last connection data");
        await Util.saveConfig();
    }
    //简单粗暴但有效
    mainWindow?.destroy();
    app.relaunch();
    app.quit();
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
    })
});
//退出应用
ipcMain.on("close_application", (_event): void => {
    logger.writeInfo("Close application")
    mainWindow?.destroy();
    app.quit();
})
//获取设备数据目录
ipcMain.handle("main_getDeviceDataPath", (_event): string => {
    return `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/`
});
//获取主配置
ipcMain.handle("main_getConfig", (_event, prop: string, defaultValue?: null | string | boolean | number) => {
    logger.writeDebug(`Handle get config "${prop}" with default value:${defaultValue}`);
    return Reflect.get(global.config, prop) ?? defaultValue ?? null;
});
//获取所有配置 方便点
ipcMain.handle("main_getAllConfig", (_event) => {
    logger.writeDebug("Handle get all config ");
    return global.config;
});
//获取设备配置 加密啥的
ipcMain.handle("main_getDeviceConfig", (_event, prop: string, defaultValue?: string | boolean | number | null) => {
    logger.writeDebug(`Handle get device config "${prop}" with default value:${defaultValue}`);
    return global.deviceConfig.getConfigProp(prop, defaultValue);
});
//获取设备所有配置
ipcMain.handle("main_getDeviceAllConfig", () => {
    logger.writeDebug("Handle get device all config ");
    return global.deviceConfig.getAllConfig();
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
//写入设备配置
ipcMain.handle("main_setDeviceConfig", (_event, prop: string, value: string | number | boolean | null) => {
    global.deviceConfig.setConfig(prop, value)
});
//创建凭证
ipcMain.handle("main_createCredentials", async () => {
    if (oauthService === null) {
        logger.writeInfo("Init oauth service");
        const oauthModule = (await import("./modules/OAuthService.js")).default
        oauthService = new oauthModule.default();
        await oauthService.init();
    }
    logger.writeInfo("Request create credentials")
    return await oauthService.createCredentials();
});
//验证凭证
ipcMain.handle("main_startAuthorization", async () => {
    if (oauthService === null) {
        logger.writeInfo("Init oauth service");
        const oauthModule = (await import("./modules/OAuthService.js")).default
        oauthService = new oauthModule.default();
        await oauthService.init();
    }
    logger.writeInfo("Request start authorization")
    return await oauthService.startAuthorization();
});
//创建桌面快捷方式
ipcMain.handle("main_createStartMenuShortcut", async () => {
    await Util.createStartMenuShortcut();
    connectedDevice.getNotificationManager()?.recheckXmlPermission();
    const result = Util.hasStartMenuShortcut();
    result && mainWindow?.webContents.send("webviewEvent", "editState", { type: "remove", id: "warn_xml_notification_cannot_show" });
    return result
});
//使用外部浏览器打开链接
ipcMain.on("main_openUrl", (_event, url: string) => {
    //再次过滤
    if (url.length > 2081 || !Util.checkUrl(url)) {
        logger.writeWarn(`Trying open a invalid or too large URL:${url}`);
        dialog.showMessageBoxSync(<BrowserWindow>mainWindow, {
            type: "error",
            title: "打开失败",
            message: "URL无效或过长",
            buttons: ["确定"]
        });
        return
    };
    logger.writeInfo(`Open url in browser:${url}`);
    shell.openExternal(url);
})
//右键菜单
ipcMain.handle("main_createRightClickMenu", async (_event, list: RightClickMenuItem[] | null) => {
    //虽然基本不可能发生
    if (list == null) return RightClickMenuItemId.Null;
    logger.writeDebug("Request create right click menu")
    return new Promise<RightClickMenuItemId>((resolve, _reject) => {
        const menu: Menu = new Menu();
        for (const customMenuItem of list) {
            menu.append(new MenuItem({
                //允许在渲染进程根据情况自定义标签名
                label: customMenuItem.label,
                click: async () => {
                    //返回id
                    logger.writeDebug(`Right click menu item ${customMenuItem.id} clicked`);
                    resolve(customMenuItem.id);
                },
                enabled: customMenuItem.enabled ?? true
            }));
        };
        menu.addListener("menu-will-close", async () => {
            //被关闭时
            //如果是被取消的 150ms后resolve还可以被执行
            setTimeout(() => {
                resolve(RightClickMenuItemId.Null);
            }, 150);
        });
        menu.popup();
    })
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
//获取设备ip
ipcMain.handle("main_getPhoneIp", () => {
    return connectedDevice?.getPhoneAddress();
});
ipcMain.on("main_downloadPhoneFile", async (_event, downloadFilePath: string) => {
    logger.writeInfo(`Request download phone file:${downloadFilePath}`);
    phoneFileDownloadPathTemp = downloadFilePath;
    if (!phoneFileDownloadWindow) {
        phoneFileDownloadWindow = new BrowserWindow({
            show: false,
            focusable: false,
            movable: false
        });
        await phoneFileDownloadWindow.webContents.session.cookies.set({
            name: "sessionId",
            value: global.clientMetadata.sessionId,
            url: `https://${connectedDevice.getPhoneAddress()}`,
            sameSite: "no_restriction",
        });
        phoneFileDownloadWindow.webContents.session.on("will-download", (_event, item) => {
            item.setSaveDialogOptions({
                title: "下载手机上的文件",
                buttonLabel: "下载到此",
                defaultPath: path.join(path.basename(phoneFileDownloadPathTemp))
            });
        });
        logger.writeInfo("Create download phone file window");
    };
    phoneFileDownloadWindow.loadURL(`https://${connectedDevice?.getPhoneAddress()}:${30767}?filePath=${encodeURIComponent(downloadFilePath)}`);
});
// 情况缓存和日志
ipcMain.handle("main_deleteCache", async () => {
    const session = (await import("electron")).session;
    const currentSession = session.defaultSession;
    await currentSession.clearCache();
    await currentSession.clearCodeCaches({});
    const logPath = `${app.getPath("userData")}/programData/logs`;
    const filesList = await fs.readdir(logPath);
    const currentLogFileName = logger.getLogFileName();
    //日志
    for (const file of filesList) {
        //跳过本次运行产生的日志文件
        if (file !== currentLogFileName) {
            //单个文件删除失败时不影响后面的
            try {
                await fs.remove(`${app.getPath("userData")}/programData/logs/${file}`)
            } catch (error) {
                logger.writeError(error as Error);
            }
        }
    }
    //直接清除assets目录 目前里面都是缓存数据
    const iconCachePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets`;
    await fs.rm(iconCachePath, { recursive: true });
    //优化目录
    const optCodePath = `${path.resolve(`${app.getPath("userData")}/programData/oat/`)}`;
    await fs.rm(optCodePath, { recursive: true });
    logger.writeInfo("Deleted all caches");
});
app.on("certificate-error", (event, _webContents, url, _error, cert, callback) => {
    if (localCertFingerprint256 === null) {
        const rawLocalCertData = fs.readFileSync(`${app.getPath("userData")}/programData/cert/cert.crt`, { encoding: "utf-8" })
        localCertFingerprint256 = new X509Certificate(rawLocalCertData).fingerprint256
    }
    const remoteCertFingerprint256 = new X509Certificate(cert.data).fingerprint256;
    if (url.startsWith(`https://${connectedDevice?.getPhoneAddress()}:${30767}`) && localCertFingerprint256 === remoteCertFingerprint256) {
        logger.writeDebug(`Certificate verified success:${url}`);
        event.preventDefault();
        callback(true);
    } else {
        logger.writeWarn(`Certificate verified failed:${url}`);
        dialog.showMessageBox({
            type: "error",
            title: "连接失败",
            message: "目标地址或证书错误 请尝试清除移动端证书或重启双方客户端",
            buttons: ["确定"]
        } as MessageBoxOptions);
        callback(false);
    }
});
ipcMain.handle("main_setAudioForward", async (_event, enable: boolean) => {
    logger.writeInfo(`Request set audio forward ${enable ? "enable" : "disable"}`);
    const AudioForward = (await import("./modules/AudioForward.js")).default.default;
    if (enable) {
        const { iv, key } = await Util.createAes128GcmKey();
        const result: any = await connectedDevice.responseManager?.send({ packetType: "main_startAudioForward", key, iv });
        if (result.result) {
            AudioForward.start(connectedDevice.getPhoneAddress(), key, iv);
        }
        return result;
    } else {
        const result: any = await connectedDevice.responseManager?.send({ packetType: "main_stopAudioForward" });
        AudioForward.stop();
        return result;
    }
});
ipcMain.on("sendMessageToMainWindow", (_event, type: string, message: { [key: string]: string | number | boolean }) => {
    logger.writeDebug(`Send message to main window:${type}`);
    mainWindow?.webContents.send("webviewEvent", type, message)
});
ipcMain.handle("main_archiveLogs", async () => {
    logger.writeDebug("Show save log file archive dialog");
    const result = await dialog.showSaveDialog(mainWindow!, {
        title: "导出程序日志",
        buttonLabel: "保存",
        defaultPath: path.join(app.getPath("home"), `Logs-${Date.now()}.zip`)
    });
    if (result.canceled) return false;
    const archiver = (await import("archiver")).default
    const archiverInstance = archiver("zip", {
        zlib: {
            level: 6
        },
    });
    const fileOutStream = fs.createWriteStream(result.filePath);
    archiverInstance.pipe(fileOutStream);
    const logPath = `${app.getPath("userData")}/programData/logs`;
    const filesList = await fs.readdir(logPath);
    logger.writeDebug(`Find ${filesList.length} log files`)
    for (const logFile of filesList) {
        const data = await fs.readFile(`${app.getPath("userData")}/programData/logs/${logFile}`);
        archiverInstance.append(data, { name: logFile })
    };
    await archiverInstance.finalize();
    logger.writeInfo("Archive log file success")
    return true
});
// 创建缓存文件
ipcMain.handle("main_createCacheFile", async (_event, name: string, data: ArrayBuffer) => {
    const filePath = path.join(app.getPath("temp"), name);
    await fs.writeFile(filePath, new DataView(data));
    cacheFilesList.add(filePath);
    logger.writeInfo(`Created cache file ${filePath}`);
    return filePath;
});
ipcMain.handle("main_showDirectoryPicker", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openDirectory", "dontAddToRecent"],
        title: "选择目录",
        buttonLabel: "确定"
    });
    return result.canceled ? null : result.filePaths[0];
})
//测试用 有些要保留
app.on("before-quit", (event) => {
    event.preventDefault();
    //异常时为null
    for (const client of connectedDevice?.clients || []) {
        client.close(ConnectionCloseCode.CloseFromServer);
    }
    //发生异常时无法调用close
    connectedDevice?.close();
    // 清理缓存文件
    if (cacheFilesList.size > 0) {
        logger.writeInfo("Cleaning cache files");
        cacheFilesList.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                logger.writeDebug(`Removing cache file:${filePath}`);
                fs.rmSync(filePath)
            }
        });
    }
    //关闭音频转发进程
    import("./modules/AudioForward.js").then(module => {
        try {
            module.default.default.stop();
            logger?.writeInfo("App quit");
        } catch {
        } finally {
            app.exit();
        }
    })
    // logger?.closeStream();
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
            const fixedOpacity=value as number/100
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                browserWindow.setOpacity(fixedOpacity);
            }
            logger.writeInfo(`Set window opacity to ${fixedOpacity}`);
            break;
        default:
            break;
    }
}