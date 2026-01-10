
const tempLogList: Array<string> = [];
const LogLevel = {
    NONE: 0,//禁用
    DEBUG: 1,//调试
    INFO: 2,//正常信息
    WARN: 3,//警告
    ERROR: 4//异常
} as const;
let init = false;
let callbackId:number|null=null;
function appendLog(level: keyof typeof LogLevel, data: string | number | boolean) {
    if(callbackId) cancelIdleCallback(callbackId);
    tempLogList.push(`[${level}] ${data}`);
    if (tempLogList.length>20) {
        flushLog();
        return
    }
    callbackId=requestIdleCallback(flushLog,{
        timeout: 1000
    });
}
function flushLog(){
    window.electronMainProcess.appendLog(tempLogList);
    tempLogList.length=0;
}
function useLogger() {
    if (init) {
        return
    }
    init = true;
    window.electronMainProcess.getConfig("logLevel", "INFO").then((value: any) => {
        const level=LogLevel[value as keyof typeof LogLevel];
        const originConsoleDebug = window.console.debug.bind(null);
        const originConsoleLog = window.console.log.bind(null);
        const originConsoleInfo = window.console.info.bind(null);
        const originConsoleWarn = window.console.warn.bind(null);
        const originConsoleError = window.console.error.bind(null);
        window.console.debug = (args) => {
            if (level <= LogLevel.DEBUG) {
                originConsoleDebug(args);
                appendLog("DEBUG", args);
            }
        }
        window.console.log = (args) => {
            if (level <= LogLevel.INFO) {
                originConsoleLog(args);
                appendLog("INFO", args);
            }
        }
        window.console.info = (args) => {
            if (level <= LogLevel.INFO) {
                originConsoleInfo(args);
                appendLog("INFO", args);
            }
        }
        window.console.warn = (args) => {
            if (level <= LogLevel.WARN) {
                originConsoleWarn(args);
                appendLog("WARN", args);
            }
        }
        window.console.error = (args) => {
            if (level <= LogLevel.ERROR) {
                originConsoleError(args);
                appendLog("ERROR", args); 
            }
        }
        window.addEventListener("error",(event)=>{
            appendLog("ERROR", `${event.message}:\n${event.error.stack}`);
        });
        window.addEventListener("unhandledrejection",(event=>{
            console.error(event.reason);
            appendLog("ERROR", `${event.reason}`);
        }));
        window.addEventListener("beforeunload",flushLog);
        window.addEventListener("pagehide",flushLog);
        console.info("Logger initd");
    });
}
export default useLogger