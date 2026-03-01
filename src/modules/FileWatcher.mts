import { FSWatcher } from "chokidar";
import { type BrowserWindow } from "electron"
import { ipcMain } from "electron";
import fs from "fs-extra";
import path from "path";
import TransmitFileUploader from "./TransmitFileUploader.js";
import ResponseManager from "./ResponseManager.js";
import { randomUUID } from "crypto";

class FileWatcher {
    private watcher: FSWatcher;
    private readonly LOG_TAG: string = "FileWatcher"
    private responseManager: ResponseManager.default;
    private browserWindow: BrowserWindow
    constructor(responseManager: ResponseManager.default, mainWindow: BrowserWindow) {
        this.browserWindow = mainWindow
        this.responseManager = responseManager;
        this.watcher = new FSWatcher({
            interval: 750,
            ignoreInitial: true,
            depth: 0,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 250
            },

        });
    }
    private async onNewFile(filePath: string, fileName: string, fileSize: number) {
        const eventId = randomUUID();
        const uploader = new TransmitFileUploader.default(filePath, {
            onError: (err) => {
                this.browserWindow.webContents.send("webviewEvent", "appendFileSyncList", { id: eventId, path: filePath, state: "error" });
                logger.writeError(`Failed to upload file ${fileName}`, this.LOG_TAG);
                logger.writeError(err, this.LOG_TAG);
            },
            onProgress: () => { },
            onSuccess: () => {
                this.browserWindow.webContents.send("webviewEvent", "appendFileSyncList", { id: eventId, path: filePath, state: "success" });
                logger.writeDebug(`File ${fileName} was uploaded`, this.LOG_TAG);
            }
        });
        const port = await uploader.init();
        await this.responseManager.send({ packetType: "main_fileSyncDownload", port, fileName, fileSize });
        this.browserWindow.webContents.send("webviewEvent", "appendFileSyncList", { id: eventId, path: filePath, fileName, state: "append" });
    }
    async init(initialPaths: string[]) {
        logger.writeDebug("Start file watcher init", this.LOG_TAG);
        this.watcher.on("add", (targetFilePath, stats) => {
            if (!stats || stats.isDirectory() || stats.size <= 0) return
            // 需要开启功能且手机端版本支持
            if (global.deviceConfig.getConfigProp<boolean>("enableFileSync", false) && global.clientMetadata.protocolVersion >= 2) {
                this.onNewFile(targetFilePath, path.basename(targetFilePath), stats.size);
                return
            }
            logger.writeDebug(`New file append to watching path:${targetFilePath}`, this.LOG_TAG);
        });
        //检查目录存在
        const existsPaths = initialPaths.filter((path) => {
            try {
                fs.accessSync(path, fs.constants.R_OK);
                logger.writeDebug(`Target path is accessible:${path}`, this.LOG_TAG);
                return true;
            } catch (error) {
                logger.writeWarn(`Failed to watch target path in accessible test.Maybe target directory is deleted:${path} `, this.LOG_TAG);
                return false;
            }
        });
        //数据量对不上的话 覆盖配置
        if (existsPaths.length !== initialPaths.length) {
            global.deviceConfig.setConfig("fileSyncTargetDirectory", existsPaths);
            logger.writeInfo("Override watching path config because some path unavailable", this.LOG_TAG);
            // 确保发送事件时页面已注册好监听器
            setTimeout(() => {
                this.browserWindow.webContents.send("webviewEvent", "editState", { type: "add", id: "warn_watch_directory_missing" });
                logger.writeDebug("Send missing directory warning to renderer process")
            }, 1500);
        }
        if (global.clientMetadata.protocolVersion >= 2) {
            logger.writeInfo("Init file watcher paths")
            this.watcher.add(existsPaths);
        } else {
            logger.writeInfo(`Android client protocol version low(${global.clientMetadata.protocolVersion}).Disable file sync`)
            //协议版本低 提醒Android端不支持功能
            setTimeout(() => {
                logger.writeDebug("Send android client too old warning to renderer process")
                this.browserWindow.webContents.send("webviewEvent", "editState", { type: "add", id: "warn_android_client_version_low" });
            }, 1500);
        }
        //无论如何都注册ipc保证基础功能
        this.ipcInit();
        logger.writeDebug("File watcher init success", this.LOG_TAG);
    }
    private async ipcInit() {
        ipcMain.handle("fileWatcher_addPath", (_event, path: string) => new Promise<boolean>((resolve) => {
            // 先测试能否访问
            try {
                fs.accessSync(path, fs.constants.R_OK);
                logger.writeInfo(`Target path is accessible:${path}`, this.LOG_TAG);
            } catch (error) {
                logger.writeError(`Failed to watch path on access test:${path} ${error}`, this.LOG_TAG);
                resolve(false);
            }
            const onErrorListener = (err: unknown) => {
                logger.writeError(`Failed to watch path:${path} ${err}`, this.LOG_TAG);
                resolve(false);
                this.watcher.off("error", onErrorListener)
            }
            this.watcher.on("error", err => {
                //崩了
                logger.writeError(`Failed to watch path:${path} ${err}`, this.LOG_TAG);
                resolve(false);
                this.watcher.off("error", onErrorListener)
            })
            this.watcher.add(path);
            setTimeout(() => {
                // 超过一段时间没有报错 成功
                this.watcher.off("error", onErrorListener)
                const currentPaths = global.deviceConfig.getConfigProp<string[]>("fileSyncTargetDirectory", []);
                global.deviceConfig.setConfig("fileSyncTargetDirectory", [...currentPaths, path])
                logger.writeInfo(`Add path to watching list:${path}`, this.LOG_TAG);
                resolve(true);
            }, 350);
        }));
        ipcMain.handle("fileWatcher_removePath", (_event, path: string) => {
            this.watcher.unwatch(path);
            const currentPaths = global.deviceConfig.getConfigProp<string[]>("fileSyncTargetDirectory", []);
            global.deviceConfig.setConfig("fileSyncTargetDirectory", currentPaths.filter(p => p !== path));
            logger.writeInfo(`Remove path from watching list:${path}`, this.LOG_TAG);
        })
    }
}
export { FileWatcher }