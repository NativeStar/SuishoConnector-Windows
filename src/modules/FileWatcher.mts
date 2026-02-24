import { FSWatcher} from "chokidar";

class FileWatcher {
    private watcher: FSWatcher;
    constructor() {
        this.watcher = new FSWatcher({
            interval:750,
            ignoreInitial:true,
            depth: 0,
            awaitWriteFinish:{
                stabilityThreshold: 750,
                pollInterval: 250
            },

        });
    }
    async init(initialPaths:string[]) {
        this.watcher.on("add",(path,stats)=>{
            if(global.deviceConfig.getConfigProp<boolean>("enableFileSync",false)){
                console.log(path,stats?.isFile());
            }
        });
        this.watcher.on("unlink",(path,stats)=>{
            if(global.deviceConfig.getConfigProp<boolean>("fileSyncDeleteOperation",false)){
                console.log(path,stats?.isFile());
            }
        })
        this.watcher.add(initialPaths);
    }
}
export {FileWatcher}