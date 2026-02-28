import { FSWatcher } from "chokidar";
import {type BrowserWindow} from "electron"
import { ipcMain } from "electron";
import fs from "fs-extra";
import path from "path";
import TransmitFileUploader from "./TransmitFileUploader.js";
import ResponseManager from "./ResponseManager.js";

class FileWatcher {
    private watcher: FSWatcher;
    private readonly LOG_TAG: string = "FileWatcher"
    private responseManager: ResponseManager.default;
    private browserWindow:BrowserWindow
    constructor(responseManager: ResponseManager.default,mainWindow: BrowserWindow) {
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
    private async onNewFile(path: string, fileName: string, fileSize: number) {
        const uploader = new TransmitFileUploader.default(path, {
            onError: (err) => {
                //TODO 通知渲染进程
                logger.writeError(`Failed to upload file ${fileName}`, this.LOG_TAG);
                logger.writeError(err, this.LOG_TAG);
            },
            onProgress: () => { },
            onSuccess: () => {
                logger.writeDebug(`File ${fileName} was uploaded`, this.LOG_TAG);
                //TODO 通知渲染进程
            }
        });
        const port = await uploader.init();
        await this.responseManager.send({ packetType: "main_fileSyncDownload", port, fileName, fileSize });
        //TODO 通知渲染进程
    }
    async init(initialPaths: string[]) {
        this.watcher.on("add", (targetFilePath, stats) => {
            if (!stats || stats.isDirectory() || stats.size <= 0) return
            // TODO 可能需要检测设备是否信任
            if (global.deviceConfig.getConfigProp<boolean>("enableFileSync", false)) {
                this.onNewFile(targetFilePath, path.basename(targetFilePath), stats.size)
            }
        });
        //检查目录存在
        const existsPaths=initialPaths.filter((path) => {
            try {
                fs.accessSync(path, fs.constants.R_OK);
                return true;
            } catch (error) {
                logger.writeWarn(`Failed to watch target path in accessible test.Maybe target directory is deleted:${path} `, this.LOG_TAG);
                return false;
            }
        });
        //数据量对不上的话 覆盖配置
        if (existsPaths.length!==initialPaths.length) {
            global.deviceConfig.setConfig("fileSyncTargetDirectory", existsPaths);
            // 确保发送事件时页面已注册好监听器
            setTimeout(() => {
                this.browserWindow.webContents.send("webviewEvent", "editState", { type: "add", id: "warn_watch_directory_missing" });
            }, 1500);
        }
        this.watcher.add(existsPaths);
        this.ipcInit();
    }
    private async ipcInit() {
        ipcMain.handle("fileWatcher_addPath", (_event, path: string) => new Promise<boolean>((resolve) => {
            // 先测试能否访问
            try {
                fs.accessSync(path, fs.constants.R_OK);
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
                resolve(true);
            }, 350);
        }));
        ipcMain.handle("fileWatcher_removePath", (_event, path: string) => {
            this.watcher.unwatch(path);
            const currentPaths = global.deviceConfig.getConfigProp<string[]>("fileSyncTargetDirectory", []);
            global.deviceConfig.setConfig("fileSyncTargetDirectory", currentPaths.filter(p => p !== path));
        })
    }
}
export { FileWatcher }