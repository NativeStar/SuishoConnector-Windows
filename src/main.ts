import { app, BrowserWindow, ipcMain, dialog, shell, Tray, nativeImage, Menu, MessageBoxOptions, nativeTheme, MenuItem } from "electron";
import path from "path";
//更改执行路径
process.chdir(app.getAppPath());
import { exec } from "child_process";
import os from "os";
import randomThing from "randomthing-js";
import fs from "fs-extra";
//自己的模块
import PhoneServer from "./modules/Server";
import Util from "./modules/Util";
import DownloadServer from "./modules/DownloadServer";
import { Config as TypeConfig } from "./modules/Util"
import { Logger, LogLevel } from "./modules/Logger";
import { getProxyWindows } from "get-proxy-settings";
import ManualConnect from "./modules/ManualConnect";
import OAuthService from "./modules/OAuthService";
import DeviceConfig from "./modules/DeviceConfig";
import Broadcaster from "./modules/Broadcaster";
import { type RightClickMenuItem, RightClickMenuItemId } from "./interface/RightClickMenuItem";
import ConnectionCloseCode from "./enum/ConnectionCloseCode";
import ApkDownloadServer from "./modules/ApkServer";
import RemoteMediaWindowSize from "./constant/remoteMediaWindowSize";
import child_process from "child_process";
import AudioForward from "./modules/AudioForward";

//随机端口号 超过60000的正则不好搞哦
let serverPort;
/** @type {PhoneServer} */
let connectedDevice: PhoneServer;
/**
 * @description 连接手机窗口
 * @type {bw} */
let connectPhoneWindow: BrowserWindow;
/**
 * @description 主操作窗口
 * @type {bw} */
let mainWindow: BrowserWindow | null = null;
//SSL证书下载服务器实例
let certDownloadServer: DownloadServer | null = null;
//手动连接中转服务器
let manualConnectRedirectServer: ManualConnect | null = null;
let oauthService: OAuthService | null = null;
//udp广播 自动连接
let broadcaster: Broadcaster | null = null;
let apkDownloadServerInstance: ApkDownloadServer | null = null;
let phoneFileDownloadWindow: BrowserWindow | null = null;
/* 
如果不这么搞触发will-download回调内读取的文件名永远是第一次触发的文件名
*/
let phoneFileDownloadPathTemp: string = "";
let trayInstance: Tray | null = null;
let devLoadLocalhost: boolean = false;
//设备配置管理
// let deviceConfig:DeviceConfig|null=null;
declare global {
    var logger: Logger
    var config: TypeConfig
    var deviceConfig: DeviceConfig
}
//阻止多实例
if (!app.requestSingleInstanceLock()) {
    //还没初始化日志模块 没必要输出
    app.quit();
}
app.on("ready", async (event, info) => {
    global.logger = new Logger(`${app.getPath("userData")}/programData/logs`);
    global.config = await Util.loadConfig();
    global.logger.setLevel(Reflect.get(LogLevel, config.logLevel));
    app.setAsDefaultProtocolClient("suisho", process.execPath, [app.getAppPath()]);
    if(!app.isPackaged){
        const result=await dialog.showMessageBox({
            type:"question",
            title:"开发模式启动",
            message:"选择启动模式",
            buttons:["本地服务器","构建产物"],
            cancelId:-1
        })
        console.log(result.response);
        if (result.response===-1) {
            app.quit();
        }
        devLoadLocalhost=result.response===0;
    }
    connectPhoneWindow = new BrowserWindow({
        titleBarStyle: "hidden",
        center: true,
        title: "Electron Application",
        resizable: false,
        autoHideMenuBar: true,
        // transparent: true,
        frame: false,
        titleBarOverlay: {
            height: 40,
            color: "#fdf7fe"
        },
        width: 330,
        height: 600,
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
    })
    connectPhoneWindow.on("ready-to-show", async () => {
        connectPhoneWindow.setMaximizable(false);
        logger.writeDebug("Connect phone window created");
        connectPhoneWindow.show();
        //!需要打包测试
        app.setName("Suisho Connector");
        app.setAppUserModelId(app.isPackaged ? "com.suisho.connector" : process.execPath);
    });
    connectPhoneWindow.setContentProtection(global.config.enableContentProtection);
    devLoadLocalhost?connectPhoneWindow.loadURL("http://localhost:5173/connect-phone"):connectPhoneWindow.loadFile("./assets.old/html/connectPhone.html");
    // connectPhoneWindow.loadFile(devLoadLocalhost?"http://localhost:5173":"./assets.old/html/connectPhone.html");
    connectPhoneWindow.setMenu(null);
    //阻止多开
    app.on("second-instance", async (event, args, dir, data) => {
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
                const fileStat = await fs.stat(lastArg);
                // console.log(lastArg);
                if (fileStat.isFile()) {
                    mainWindow?.webContents.send("webviewEvent", "transmit_upload_file", path.basename(lastArg), lastArg, fileStat.size);
                } else if (fileStat.isDirectory()) {
                    mainWindow.webContents.send("webviewEvent", "showSnakeBar", "暂不支持上传文件夹");
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
                if (argString.endsWith("clickNotification")) {
                    connectedDevice?.notificationCore?.onNotificationClick();
                }
                return
            }
        }
    });
    //开控制台 记得删掉
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
});
//ipc
ipcMain.handleOnce("connectPhone_initServer", async (event) => {
    let trayInitd = false;
    //检查并获取配置文件
    await Util.updateConfig();
    {
        const portInfo = await Util.findUsablePort();
        if (portInfo.state) {
            serverPort = portInfo.port;
            logger.writeInfo(`Use port ${portInfo.port}`)
        } else {
            //找不到端口
            logger.writeError(`Cannot find port`);
            return new Error("找不到可用端口");
        }
    }
    await Util.ensureCert();
    //检测Clash 这玩意会导致拿不到真实ip
    const networkInterfaces = os.networkInterfaces();
    logger.writeInfo(`Network interfaces:${Reflect.ownKeys(networkInterfaces)}`);
    if (Reflect.has(networkInterfaces, "Clash")) {
        logger.writeWarn('Found working "Clash" virtual network device');
        return new Error("Clash");
    }
    connectedDevice = new PhoneServer(<number>serverPort, connectPhoneWindow, {
        openMainWindow: () => {
            logger.writeDebug("Invoke open main window");
            //初始化设备配置管理器
            global.deviceConfig = new DeviceConfig(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/config/device.json`);
            if (!connectPhoneWindow.isDestroyed()) connectPhoneWindow.close();
            mainWindow = new BrowserWindow({
                center: true,
                titleBarStyle: "hidden",
                title: `Suisho Connector:${global.clientMetadata.model}`,
                resizable: false,
                autoHideMenuBar: true,
                frame: false,
                titleBarOverlay: {
                    height: 40,
                    color: nativeTheme.shouldUseDarkColors ? "#1d1b1e" : "#fdf7fe",
                    symbolColor: nativeTheme.shouldUseDarkColors ? "#fdf7fe" : "#1d1b1e"
                },
                // width: 850,
                // height: 650,
                show: false,
                // skipTaskbar:true,
                webPreferences: {
                    spellcheck: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload/mainPreload.js'),
                }
            });
            mainWindow.hookWindowMessage(278, () => {
                mainWindow?.setEnabled(false);
                setTimeout(() => {
                    mainWindow?.setEnabled(true);
                }, 50);
            });
            mainWindow.on("ready-to-show", () => {
                mainWindow?.setMaximizable(false);
                // mainWindow?.show();
                connectedDevice.setWindow(<BrowserWindow>mainWindow);
                //尝试修复窗口不显示
                // setTimeout(() => {
                mainWindow?.show();
                if (!trayInitd) {
                    initTray();
                    trayInitd = true;
                }
                setTimeout(() => {
                    connectedDevice.socket?.send(JSON.stringify({ packetType: "main_server_initialled" }));
                }, 150);
                // }, 200);
                logger.writeInfo("Opened main window");
            });
            mainWindow.setMenu(null);
            mainWindow.loadFile("./assets/html/main.html");
            mainWindow.setContentProtection(global.config.enableContentProtection);
            mainWindow.on("closed", () => {
                mainWindow = null;
            });
            mainWindow.on("close", (event) => {
                //断开连接后关闭窗口不保留后台
                if (connectedDevice.isClosed) {
                    mainWindow?.destroy();
                    app.quit();
                    return
                }
                event.preventDefault();
                mainWindow?.hide();
            });
            mainWindow.webContents.setWindowOpenHandler((detail) => {
                if (detail.url.endsWith("assets/html/mediaProjection.html")) {
                    return {
                        action: "allow",
                        overrideBrowserWindowOptions: {
                            resizable: true,
                            autoHideMenuBar: true,
                            center: true,
                            webPreferences: {
                                preload: path.join(__dirname, "preload/mediaProjectionPreload.js")
                            }
                        }
                    }
                };
                return { action: "deny" }
            });
            //关闭和发起连接有关的服务
            certDownloadServer?.close();
            certDownloadServer = null;
            manualConnectRedirectServer?.close();
            manualConnectRedirectServer = null;
            broadcaster?.close();
            broadcaster = null;
            apkDownloadServerInstance?.close();
            nativeTheme.addListener("updated", () => {
                //空对象
                if (mainWindow == null || mainWindow.isDestroyed()) {
                    return
                }
                if (nativeTheme.shouldUseDarkColors) {
                    mainWindow.setTitleBarOverlay({
                        height: 40,
                        color: "#1d1b1e",
                        symbolColor: "#fdf7fe"
                    })
                } else {
                    mainWindow.setTitleBarOverlay({
                        height: 40,
                        color: "#fdf7fe"
                        , symbolColor: "#1d1b1e"
                    })
                }
            });
        },
        getTrayInstance() {
            return trayInstance;
        },
    });
    //SSL证书下载服务器
    if (certDownloadServer === null) {
        certDownloadServer = new DownloadServer(`${path.resolve(`${app.getPath("userData")}/programData/cert/certs.pak`)}`, 6735, "SSLCertDownload");
        await certDownloadServer.init();
        logger.writeInfo(`Cert download server started at port:${certDownloadServer.serverPost}`);
    } else {
        logger.writeDebug("Skipped download server init")
    }
    global.serverAddress = Util.getIPAdress(os.networkInterfaces());
    //将服务器地址打进全局
    logger.writeInfo(`Local address is ${global.serverAddress}`);
    //手动连接服务
    manualConnectRedirectServer = new ManualConnect(<number>serverPort, certDownloadServer.serverPost, global.config.deviceId);
    manualConnectRedirectServer.init();
    return {
        address: global.serverAddress,
        port: serverPort,
        certDownloadPort: certDownloadServer.serverPost,
        id: global.config.deviceId
    }
});
function initTray() {
    //创建托盘图标
    const trayImage: Electron.NativeImage = nativeImage.createFromPath("./res/tray.png");
    trayInstance = new Tray(trayImage);
    trayInstance.setTitle("Suisho Connector");
    trayInstance.setToolTip("Suisho Connector");
    trayInstance.addListener("double-click", () => {
        if (mainWindow !== null) {
            mainWindow.show();
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        } else {
            //窗口被释放
            mainWindow = new BrowserWindow({
                center: true,
                title: `Suisho Connector:${global.clientMetadata.model}`,
                resizable: false,
                autoHideMenuBar: true,
                frame: true,
                show: false,
                // skipTaskbar:true,
                webPreferences: {
                    spellcheck: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload/mainPreload.js'),
                }
            });
            mainWindow.loadFile("./assets/html/main.html");
            mainWindow.setMenu(null);
            mainWindow.hookWindowMessage(278, () => {
                mainWindow?.setEnabled(false);
                setTimeout(() => {
                    mainWindow?.setEnabled(true);
                }, 50);
            });
            mainWindow.once("ready-to-show", () => {
                mainWindow?.show();
                logger.writeInfo("Opened main window");
                connectedDevice.setWindow(<BrowserWindow>mainWindow);
            });
            mainWindow.on("closed", () => {
                mainWindow = null;
            });
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
        //debug
        {
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
    trayInstance.setContextMenu(Menu.buildFromTemplate(trayMenu));
}
//未捕获异常弹窗 给点功能选择
process.on("uncaughtException", (error, origin) => {
    console.log(error);
    logger.writeError(error);
    dialog.showMessageBox({
        type: "error",
        message: `主进程发生异常:\n${error.name}:${error.message}\n${error.stack}`,
        buttons: ["忽略", "重启", "退出"],
        defaultId: 0,
        title: "应用程序异常"
    } as MessageBoxOptions).then((result) => {
        switch (result.response) {
            case 0:
                //忽略
                break;
            case 1:
                //重启
                logger.writeInfo("App relaunching because exception");
                mainWindow?.destroy();
                app.relaunch();
                app.quit();
                break;
            case 2:
                //退出
                mainWindow?.destroy();
                app.quit();
                break;
        }
    });
});
//是否开发模式
ipcMain.handle("isDeveloping", event => {
    return Util.isDeveloping;
})
//关闭服务器
ipcMain.handle("rebootServer", (event) => {
    serverPort = randomThing.number(1, 60000);
    connectedDevice.close();
});
//返回基础信息
ipcMain.handle('main_getDeviceBaseInfo', event => {
    //调用两次不算bug 一次主页一次数据库
    logger.writeInfo(`connected device base info:${global.clientMetadata}`);
    return global.clientMetadata
});
//获取用户文件夹
ipcMain.handle("main_getUserPath", () => {
    logger.writeDebug(`Return user path:${app.getPath("userData")}`);
    return app.getPath("userData");
});
//写入文件
// ipcMain.handle("main_writeFile", async (event, path, str) => {
//     logger.writeDebug(`Renderer process request write file:${path}`)
//     return await fs.writeFile(path, str);
// });
//使用资源管理器打开文件或文件夹
ipcMain.handle("main_openInExplorer", (event, type, filePath) => {
    switch (type) {
        //互传文件文件夹
        case "transmitFolder":
            const dir = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`;
            //防止首次连接还没有目录时打开报错
            if (!fs.existsSync(dir)) {
                fs.ensureDirSync(dir);
            }
            shell.openPath(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`.replaceAll("/", "\\"));
            logger.writeInfo(`Open folder in exploder:${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`)
            break
        case "transmitFile":
            if (!fs.existsSync(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${filePath}`)) {
                logger.writeInfo(`Request open in Exploder file not found:${filePath}`);
                return false;
            }
            shell.showItemInFolder(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${filePath}`.replaceAll("/", "\\"));
            logger.writeDebug(`Show file in exploder:{app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${filePath}`);
            return true;
    }
});
//获取互传文件路径
ipcMain.handle("transmit_generateTransmitFileURL", (event, file) => {
    logger.writeDebug(`Generate file URL:file://${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${file}`);
    return `file://${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${file}`.replaceAll("\\", "/");
});
ipcMain.handle("main_shellOpenFile", async (event, file) => {
    const filePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${file}`.replaceAll("/", "\\");
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
ipcMain.on("reboot_application", (event): void => {
    logger.writeInfo("Reboot application")
    //简单粗暴但有效
    mainWindow?.destroy();
    app.relaunch();
    app.quit();
});
//打开代理设置
ipcMain.on("connectPhone_openProxySetting", (event) => {
    exec("start ms-settings:network-proxy")
});
//局域网扫描绑定设备
ipcMain.on("main_startAutoConnectBroadcast", () => {
    logger.writeInfo("Start auto connect broadcast")
    //开始广播
    broadcaster = new Broadcaster(global.config.boundDeviceKey as any);
    broadcaster.start();
});
//退出应用
ipcMain.on("close_application", (event): void => {
    logger.writeInfo("Close application")
    mainWindow?.destroy();
    app.quit();
})
//获取设备数据目录
ipcMain.handle("main_getDeviceDataPath", (event): string => {
    return `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/`
});
//代理检测
ipcMain.handle("connectPhone_detectProxy", async () => {
    return await getProxyWindows() !== null
})
//获取主配置
ipcMain.handle("main_getConfig", (event, prop: string) => {
    return Reflect.get(global.config, prop) ?? null;
});
//获取所有配置 方便点
ipcMain.handle("main_getAllConfig", (event) => {
    return global.config;
});
//获取设备配置 加密啥的
ipcMain.handle("main_getDeviceConfig", (event, prop: string) => {
    return global.deviceConfig.getConfigProp(prop);
});
//获取设备所有配置
ipcMain.handle("main_getDeviceAllConfig", () => {
    return global.deviceConfig.getAllConfig();
});
//写入配置
ipcMain.handle("main_setConfig", (event, prop: string, value: string | number | boolean | null) => {
    if (Reflect.has(global.config, prop)) {
        Reflect.set(global.config, prop, value);
        //保存配置
        Util.saveConfig();
        logger.writeDebug(`Set config ${prop} to ${value}`);
        //对防录屏配置的处理 即时生效
        //如果未来需要即时生效的配置增加则独立出去
        if (prop === "enableContentProtection") {
            for (const browserWindow of BrowserWindow.getAllWindows()) {
                browserWindow.setContentProtection(value as boolean);
            }
            logger.writeInfo(`${value ? "enabled" : "disabled"} content protection`);
        }
    } else {
        logger.writeWarn(`Set config ${prop} not found`);
    }
});
//写入设备配置
ipcMain.handle("main_setDeviceConfig", (event, prop: string, value: string | number | boolean | null) => {
    global.deviceConfig.setConfig(prop, value)
});
//创建凭证
ipcMain.handle("main_createCredentials", async () => {
    if (oauthService === null) {
        oauthService = new OAuthService();
        await oauthService.init();
    }
    return await oauthService.createCredentials();
});
//验证凭证
ipcMain.handle("main_startAuthorization", async () => {
    if (oauthService === null) {
        oauthService = new OAuthService();
        await oauthService.init();
    }
    return await oauthService.startAuthorization();
});
//创建桌面快捷方式
ipcMain.handle("main_createStartMenuShortcut", () => {
    Util.createStartMenuShortcut();
    connectedDevice.getNotificationManager()?.recheckXmlPermission();
    return Util.hasStartMenuShortcut();
});
//使用外部浏览器打开链接
ipcMain.on("main_openUrl", (event, url: string) => {
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
ipcMain.handle("main_createRightClickMenu", async (event, list: RightClickMenuItem[] | null) => {
    //虽然基本不可能发生
    if (list == null) return RightClickMenuItemId.Null;
    return new Promise<RightClickMenuItemId>((resolve, reject) => {
        const menu: Menu = new Menu();
        for (const customMenuItem of list) {
            menu.append(new MenuItem({
                //允许在渲染进程根据情况自定义标签名
                label: customMenuItem.label,
                click: async () => {
                    //返回id
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
ipcMain.handle("main_openDebugPanel", () => {
    const panelWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            preload: path.resolve(path.join(__dirname, "preload/debugPanelPreload.js")),
            // v8CacheOptions
        },
        show: false,
    });
    panelWindow.loadFile("./assets/html/debugPanel.html");
    panelWindow.setMenu(null);
    panelWindow.setContentProtection(global.config.enableContentProtection);
    panelWindow.once("ready-to-show", () => {
        panelWindow.show();
    });
});
ipcMain.handle("debug_sendMainWindowEvent", (event, name, ...data) => {
    mainWindow?.webContents.send("webviewEvent", name, ...data);
});
//开启apk下载服务器
ipcMain.handle("main_startApkDownloadServer", () => {
    if (!apkDownloadServerInstance) {
        apkDownloadServerInstance = new ApkDownloadServer();
        apkDownloadServerInstance.start();
    }
});
//打开远程媒体播放器
ipcMain.handle("main_openRemoteMediaPlayer", async (event, type: "audio" | "video" | "image", remoteFilePath: string) => {
    logger.writeInfo(`open remote media file:${remoteFilePath}`);
    //只能存在一个视频窗口
    for (const browserWindow of BrowserWindow.getAllWindows()) {
        if (browserWindow.getTitle() === "视频播放器" && type === "video") {
            if (!browserWindow.isDestroyed()) browserWindow.close();
        }
    }
    const remoteMediaPlayerWindow = new BrowserWindow({
        width: RemoteMediaWindowSize.width[type],
        height: RemoteMediaWindowSize.height[type],
        titleBarStyle: type !== "audio" ? "default" : "hidden",
        center: true,
        title: `Remote media player`,
        autoHideMenuBar: true,
        frame: type !== "audio",
        titleBarOverlay: type === "audio" ? {
            height: 40,
            color: "#fdf7fe"
        } : {},
        show: false,
        resizable: type !== "audio"
    });
    remoteMediaPlayerWindow.setMenu(null);
    remoteMediaPlayerWindow.setContentProtection(global.config.enableContentProtection);
    remoteMediaPlayerWindow.hookWindowMessage(278, () => {
        remoteMediaPlayerWindow?.setEnabled(false);
        setTimeout(() => {
            remoteMediaPlayerWindow?.setEnabled(true);
        }, 50);
    });
    await remoteMediaPlayerWindow.webContents.session.cookies.set({
        name: "sessionId",
        value: global.clientMetadata.sessionId,
        url: `https://${connectedDevice.getPhoneAddress()}`,
        sameSite: "no_restriction",
    });
    if (type === "audio") {
        remoteMediaPlayerWindow.loadFile("./assets/html/audioPlayerWindow.html", { query: { filePath: remoteFilePath, remoteAddr: connectedDevice.getPhoneAddress() } });
    } else if (type === "video") {
        remoteMediaPlayerWindow.loadFile("./assets/html/videoPlayerWindow.html", { query: { filePath: remoteFilePath, remoteAddr: connectedDevice.getPhoneAddress() } });
    } else if (type === "image") {
        remoteMediaPlayerWindow.loadFile("./assets/html/imageViewerWindow.html", { query: { filePath: remoteFilePath, remoteAddr: connectedDevice.getPhoneAddress() } });
    } else {
        logger.writeError(`Invalid media type:${type}`);
    }
    remoteMediaPlayerWindow.on("ready-to-show", () => {
        remoteMediaPlayerWindow.setMaximizable(false);
        remoteMediaPlayerWindow.show();
    });
});
ipcMain.handle("main_checkAndroidClientPermission", (event, permission: string) => {
    return connectedDevice?.checkAndroidClientPermission(permission);
});
//获取设备ip
ipcMain.handle("main_getPhoneIp", () => {
    return connectedDevice?.getPhoneAddress();
});
ipcMain.on("main_downloadPhoneFile", async (event, downloadFilePath: string) => {
    phoneFileDownloadPathTemp = downloadFilePath;
    if (!phoneFileDownloadWindow) {
        phoneFileDownloadWindow = new BrowserWindow({
            show: false,
            focusable: false,
            movable: false
        });
        phoneFileDownloadWindow.setMenu(null);
        await phoneFileDownloadWindow.webContents.session.cookies.set({
            name: "sessionId",
            value: global.clientMetadata.sessionId,
            url: `https://${connectedDevice.getPhoneAddress()}`,
            sameSite: "no_restriction",
        });
        phoneFileDownloadWindow.webContents.session.on("will-download", (event, item, webContents) => {
            item.setSaveDialogOptions({
                title: "下载手机上的文件",
                buttonLabel: "下载到此",
                defaultPath: path.join(path.basename(phoneFileDownloadPathTemp))
            });
        });
    };
    phoneFileDownloadWindow.loadURL(`https://${connectedDevice?.getPhoneAddress()}:${30767}?filePath=${downloadFilePath}`);
});
ipcMain.handle("main_deleteLogs",async ()=>{
    const logPath=`${app.getPath("userData")}/programData/logs`;
    const filesList=await fs.readdir(logPath);
    const currentLogFileName=logger.getLogFileName();
    for (const file of filesList) {
        //跳过本次运行产生的日志文件
        if (file!==currentLogFileName) {
            //单个文件删除失败时不影响后面的
            try {
                await fs.remove(`${app.getPath("userData")}/programData/logs/${file}`)
            } catch (error) {
                logger.writeError(error as Error);
            }
        }
    }
    logger.writeInfo("Deleted all logs");
});
app.on("certificate-error", (event, webContents, url, error, cert, callback) => {
    // console.log(url);
    if (url.startsWith(`https://${connectedDevice?.getPhoneAddress()}:${30767}`)) {
        event.preventDefault();
        callback(true);
    } else {
        dialog.showMessageBox({
            type: "error",
            title: "连接失败",
            message: "目标地址错误 请尝试重启双方客户端",
            buttons: ["确定"]
        } as MessageBoxOptions);
        callback(false);
    }
});
//关闭apk下载服务器
// ipcMain.handle("main_closeApkDownloadServer", () => {
//     apkDownloadServerInstance?.close();
//     apkDownloadServerInstance = null;
// });

ipcMain.handle("main_setAudioForward",async (event,enable:boolean)=>{
    if (enable) {
        AudioForward.start(connectedDevice.getPhoneAddress())
    }else{
        AudioForward.stop();
    }
});
//测试用 有些要保留
app.on("before-quit", () => {
    //异常时为null
    for (const client of connectedDevice?.clients || []) {
        client.close(ConnectionCloseCode.CloseFromServer);
    }
    //关闭音频转发进程
    AudioForward.stop();
    //发生异常时无法调用close
    connectedDevice?.close();
    logger?.writeInfo("App quit");
    // logger?.closeStream();
});