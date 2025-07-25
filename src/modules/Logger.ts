import fs from "fs-extra";
import os from "os";
import randomthing from "randomthing-js";
import build from "../constant/build.prop.json"
import textArray from "../constant/LogEasterEggs.json"
enum LogLevel {
    NONE,//禁用
    DEBUG,//调试
    INFO,//正常信息
    WARN,//警告
    ERROR//异常
}
//支持的输入类型
type logInput = number | string | object | Error
class Logger {
    private logPath: string;
    private level: LogLevel;
    writeStream: fs.WriteStream;
    constructor(path: string, level?: LogLevel) {
        this.logPath = path;
        this.level = level??LogLevel.INFO;
        const date: number = Date.now();
        const filePath: string = `${this.logPath}/${date}.log`;
        //获取原本是否存在
        const existFile = fs.existsSync(filePath);
        //保证存在
        fs.ensureFileSync(filePath);
        this.writeStream = fs.createWriteStream(`${this.logPath}/${date}.log`, { autoClose: true, encoding: "utf-8" });
        //首个文件写入头部
        if (!existFile) {
            this.writeStream.write(this.getLogHeaderString());
        }
        this.writeInfo("Logger init success!")
    }
    /**
     * 输出调试
     */
    writeDebug(data: logInput,tag?:string): void {
        if (this.level <= LogLevel.DEBUG) {
            const tempStr = `[DEBUG] [${this.getTimeString()}] ${tag?`[${tag}] `:""}${data}`;
            this.writeStream.write(tempStr + "\n");
            console.log("\x1B[90m" + tempStr + "\x1b[0m");
        }
    }
    /**
     * 输出信息
     * @param data 
     */
    writeInfo(data: logInput,tag?:string): void {
        if (this.level <= LogLevel.INFO) {
            const tempStr = `[INFO] [${this.getTimeString()}] ${tag?`[${tag}] `:""}${data}`
            this.writeStream.write(tempStr + "\n");
            //默认色
            console.log(tempStr);
        }
    }
    /**
     * 输出警告
     * @param data 
     */
    writeWarn(data: logInput,tag?:string): void {
        if (this.level <= LogLevel.WARN) {
            const tempStr = `[WARN] [${this.getTimeString()}] ${tag?`[${tag}] `:""}${data}`
            this.writeStream.write(tempStr + "\n");
            console.log("\x1B[33m" + tempStr + "\x1b[0m");
        }
    }
    /**
     * 输出异常
     * @param data 
     * @returns 
     */
    writeError(data: logInput,tag?:string): void {
        if (this.level <= LogLevel.ERROR) {
            if (data instanceof Error) {
                const tempStr = `[ERROR] [${this.getTimeString()}] ${tag?`[${tag}] `:""}${data.name}:${data.message}\n${data.stack}`;
                this.writeStream.write(tempStr + "\n");
                console.log("\x1B[31m" + tempStr + "\x1b[0m");
                return
            }
            const tempStr = `[ERROR] [${this.getTimeString()}] ${tag?`[${tag}] `:""}${data}`
            this.writeStream.write(tempStr + "\n");
            console.log("\x1B[31m" + tempStr + "\x1b[0m");
        }
    }
    closeStream():void{
        this.writeStream.end();
        this.writeStream.close();
    }
    setLevel(level:LogLevel){
        if (level==null) return
        this.level=level;
    }
    /**
     * 日志头
     */
    private getLogHeaderString(): string {
        const locale: Intl.ResolvedDateTimeFormatOptions = Intl.DateTimeFormat().resolvedOptions();
        return `------------------------LOG HEADER BEGIN ------------------------
Locale:${locale.locale}
TimeZone:${locale.timeZone}
Date:${this.getTimeString()}
Hostname:${os.hostname()}
Username:${os.userInfo().username}
OS Version:${os.version()}:${os.release()}
CPU Model:${os.cpus()[0].model}
Memory:${(os.totalmem() - os.freemem()) / 1024 / 1024}MB/${os.totalmem() / 1024 / 1024}MB
Machine:${os.machine()}
Platform:${os.platform()}
Arch:${os.arch()}
Execute Path:${process.execPath}
Current working directory:${process.cwd()}
Application Version:${build.APPLICATION_VERSION_CODE}
Application Version Name:${build.APPLICATION_VERSION_NAME}
()=>     ${this.getRandomEasterEggText()}     <=()
------------------------LOG HEADER END ------------------------\n`;
    }
    private getTimeString(): string {
        const date: Date = new Date();
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}---${date.getHours()}:${date.getMinutes()}:${date.getUTCSeconds()}`
    }
    //彩蛋
    private getRandomEasterEggText(): string {
        return textArray[randomthing.number(0, textArray.length - 1)];
    }
}
export default Logger;
export {
    Logger,
    LogLevel
}