import { ipcMain } from "electron";
import Util from "../modules/Util";
import { dialog, shell, BrowserWindow, app } from "electron";
import type { MessageBoxOptions } from "electron";
import type OAuthService from "./OAuthService";
import type PhoneServer from "./Server";
import { RightClickMenuItemId, type RightClickMenuItem } from "shared/const/RightClickMenuItems"
import ConnectionCloseCode from "../enum/ConnectionCloseCode";


export function registerStartupIpcHandles() {
    //是否开发模式
    ipcMain.handle("isDeveloping", _event => {
        return Util.isDeveloping;
    });
    //获取主配置
    ipcMain.handle("main_getConfig", (_event, prop: string, defaultValue?: null | string | boolean | number) => {
        logger.writeDebug(`Handle get config "${prop}" with default value:${defaultValue}`);
        return Reflect.get(global.config, prop) ?? defaultValue ?? null;
    });
    //使用外部浏览器打开链接
    ipcMain.on("main_openUrl", (event, url: string) => {
        //再次过滤
        if (url.length > 2081 || !Util.checkUrl(url)) {
            logger.writeWarn(`Trying open a invalid or too large URL:${url}`);
            dialog.showMessageBoxSync(BrowserWindow.getAllWindows()[0], {
                type: "error",
                title: "打开失败",
                message: "URL无效或过长",
                buttons: ["确定"]
            });
            return
        };
        logger.writeInfo(`Open url in browser:${url}`);
        shell.openExternal(url);
    });
    //重启程序
    ipcMain.once("reboot_application", async (_event, clearConnectionCache = false): Promise<void> => {
        logger.writeInfo("Reboot application");
        if (clearConnectionCache) {
            //清除缓存连接数据
            global.config["internal:lastConnectionAddress"] = ""
            global.config["internal:lastConnectionName"] = ""
            logger.writeDebug("Cleared last connection data");
            await Util.saveConfig();
        }
        //简单粗暴但有效
        for (const win of BrowserWindow.getAllWindows()) {
            win.destroy();
        }
        app.relaunch();
        app.quit();
    });
}
export async function registerConnectedIpcHandles(connectedDevice: PhoneServer, mainWindow: BrowserWindow) {
    const { app, nativeImage, Menu, MenuItem } = (await import("electron"));
    const fs = (await import("fs-extra")).default
    const path = await import("path");
    const { X509Certificate } = await import("crypto");
    let oauthService: OAuthService | null = null;
    let phoneFileDownloadPathTemp: string = "";
    let phoneFileDownloadWindow: BrowserWindow | null = null;
    let localCertFingerprint256: string | null = null;
    const cacheFilesList = new Set<string>();

    //退出应用
    ipcMain.once("close_application", (_event): void => {
        logger.writeInfo("Close application")
        for (const win of BrowserWindow.getAllWindows()) {
            win.destroy();
        }
        app.quit();
    });
    //获取设备数据目录
    ipcMain.handle("main_getDeviceDataPath", (_event): string => {
        return `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/`
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
    //返回基础信息
    ipcMain.handle('main_getDeviceBaseInfo', _event => {
        //调用两次不算bug 一次主页一次数据库
        logger.writeDebug(`connected device base info:${global.clientMetadata}`);
        return global.clientMetadata
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
    });
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
    });
    //写入设备配置
    ipcMain.handle("main_setDeviceConfig", (_event, prop: string, value: string | number | boolean | null) => {
        global.deviceConfig.setConfig(prop, value)
    });
    //创建凭证
    ipcMain.handle("main_createCredentials", async () => {
        if (oauthService === null) {
            logger.writeInfo("Init oauth service");
            const oauthModule = (await import("./OAuthService.js")).default
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
            const oauthModule = (await import("./OAuthService.js")).default
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
    //右键菜单
    ipcMain.handle("main_createRightClickMenu", async (_event, list: RightClickMenuItem[] | null) => {
        //虽然基本不可能发生
        if (list == null) return RightClickMenuItemId.Null;
        logger.writeDebug("Request create right click menu")
        return new Promise<RightClickMenuItemId>((resolve, _reject) => {
            const menu = new Menu();
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
    // 清空缓存和日志
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
        const AudioForward = (await import("./AudioForward.js")).default.default;
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
    //绝大多数收尾工作只在连接后有意义
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
        import("./AudioForward.js").then(module => {
            try {
                module.default.default.stop();
                logger?.writeInfo("App quit");
            } catch {
            } finally {
                app.exit();
            }
        })
    });
    ipcMain.handle("main_showDirectoryPicker", async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ["openDirectory", "dontAddToRecent"],
            title: "选择目录",
            buttonLabel: "确定"
        });
        return result.canceled ? null : result.filePaths[0];
    });
    ipcMain.handle("main_getConnectedDeviceHistory", async () => {
        logger.writeInfo("Generating connected device history list")
        const deviceFolderList = await fs.readdir(`${app.getPath("userData")}/programData/devices_data/`);
        const tempDeviceList = [];
        for (const item of deviceFolderList) {
            try {
                if ((await fs.stat(`${app.getPath("userData")}/programData/devices_data/${item}`)).isDirectory()) {
                    const deviceInfo = await fs.readJson(`${app.getPath("userData")}/programData/devices_data/${item}/config/device.json`);
                    tempDeviceList.push({
                        id: item,
                        name: deviceInfo.deviceName
                    });
                    logger.writeDebug(`Read device info:${item}:${deviceInfo.deviceName}`);
                }
            } catch (error) {
                logger.writeError(`Read device info failed:${error}`);
                continue
            }
        };
        return tempDeviceList;
    });
    ipcMain.handle("main_deleteConnectedHistoryDeviceData", async (_event, deviceId: string) => {
        try {
            const targetPath=`${app.getPath("userData")}/programData/devices_data/${deviceId}`;
            logger.writeInfo(`Deleting device data:${deviceId}`);
            //处理之前删不干净的bug 此时目录已经不存在了
            if (!await fs.exists(targetPath)) {
                logger.writeInfo(`Device data not exists:${deviceId}`);
                return true;
            }
            await fs.rm(targetPath, { recursive: true })
            return true
        } catch (error) {
            logger.writeError(`Delete device data failed:${error}`);
            return false
        }
    })
}