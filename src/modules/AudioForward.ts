import child_process from "child_process";
import { app } from "electron";
import path from "path";
class AudioForward{
    private static audioProcess:child_process.ChildProcess|null=null;
    private static readonly LOG_TAG="AudioForward";
    public static start(targetAddress:string,key:string,iv:string){
        //避免覆盖现有进程
        if (this.audioProcess) return;
        const filePath = path.join(app.getAppPath(), "dist", "process", "AudioProcess.js");
        logger.writeInfo(`Starting audio forward process.Args: ${targetAddress} ${key} ${iv}`,this.LOG_TAG);
        this.audioProcess=child_process.fork(filePath,[targetAddress,key,iv]);
    }
    public static stop(){
        this.audioProcess?.kill("SIGINT");
        this.audioProcess=null;
        logger.writeInfo("Stopped audio forward process",this.LOG_TAG);
    }
}
export default AudioForward; 