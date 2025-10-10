import child_process from "child_process";
import { app } from "electron";
class AudioForward{
    private static audioProcess:child_process.ChildProcess|null=null;
    public static start(targetAddress:string){
        //避免覆盖现有进程
        if (this.audioProcess) return;
        this.audioProcess=child_process.fork(`${process.cwd()}${app.isPackaged?"/":"/dist/"}process/AudioProcess.js`,[targetAddress]);
    }
    public static stop(){
        this.audioProcess?.kill("SIGINT");
        this.audioProcess=null;
    }
}
export default AudioForward; 