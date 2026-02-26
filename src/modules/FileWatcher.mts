import { FSWatcher } from "chokidar";
import { ipcMain } from "electron";
import fs from "fs-extra";

class FileWatcher {
    private watcher: FSWatcher;
    private LOG_TAG: string = "Server";
    constructor() {
        this.watcher = new FSWatcher({
            interval: 750,
            ignoreInitial: true,
            depth: 0,
            awaitWriteFinish: {
                stabilityThreshold: 750,
                pollInterval: 250
            },

        });
    }
    async init(initialPaths: string[]) {
        this.watcher.on("add", (path, stats) => {
            if (global.deviceConfig.getConfigProp<boolean>("enableFileSync", false)) {
                console.log(path, stats?.isFile());
            }
        });
        this.watcher.add(initialPaths);
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