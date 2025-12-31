import net from "net";
import { app } from 'electron';
import fs from "fs-extra";
import Util from "./Util";
class SocketFileWriter {
    port: number;
    target: string;
    fileSize: number | null;
    isVerified: boolean;
    fileSocket: net.Server;
    writeStream: fs.WriteStream | undefined;
    eventHandle?: FileWriterEventHandle;
    filePath: string;
    constructor(socketPort: number, writeDir: string, filePath: string, fileSize: number | null) {
        this.port = socketPort;
        this.target = writeDir;
        this.fileSize = fileSize;
        this.isVerified = false;
        this.filePath = filePath;
        this.beforeQuit = this.beforeQuit.bind(this)
        this.fileSocket = net.createServer(socket => this.onConnection(socket));
        logger.writeDebug("Socket file writer created");
    }
    async init() {
        //删除同名文件
        if (await fs.exists(this.target)) {
            await fs.remove(this.target);
        }
        //退出前
        app.addListener("before-quit", this.beforeQuit);
        return new Promise<void>((resolve, reject) => {
            logger.writeDebug(`Socket file writer listening port:${this.port}`);
            this.fileSocket.on("error", (err) => { 
                reject(err);
            });
            this.fileSocket.listen(this.port, () => {
                // fs创流
                try {
                    fs.ensureDirSync(this.filePath);
                    this.writeStream = fs.createWriteStream(this.target);
                    this.writeStream.on("open", () => resolve());
                    logger.writeInfo(`File ready download at:${this.target}`);
                } catch (error) {
                    logger.writeError(`Create file write stream error:${error}`);
                    reject(error);
                    return
                }
            });
        })
    }
    private onConnection(socket: net.Socket) {
        logger.writeDebug("File writer socket connected");
        //验证
        const verifyTimer = setTimeout(() => {
            logger.writeWarn(`Transmit file writer connect timeout. file:${this.target}`);
            socket.end();
            this.writeStream?.close();
            fs.remove(this.target);
        }, 8000);
        //验证
        //第一个包必须是AndroidId 
        //计时器 超时无响应直接失败
        socket.on("data", (data: Buffer) => {
            if (!this.isVerified) {
                //只要收到验证响应就清除定时器
                clearTimeout(verifyTimer);
                //检查
                if (data.toString() === global.clientMetadata.androidId) {
                    this.isVerified = true;
                    logger.writeInfo(`File writer device verify success:${data.toString()}`);
                    //发送开始信号
                    //\r用于掐断readLine
                    if (!socket.destroyed) socket.write("START\r");
                    return
                } else {
                    logger.writeWarn(`Transmit file writer device verify failed:${data.toString()}`);
                    //不通过 关闭socket
                    if (!socket.destroyed) socket.end("VERIFY_FAILED\r");
                    return
                }
            }
            // 通过 写入流
            this.writeStream?.write(data);
        });
        socket.on("error", err => {
            logger.writeError(`File writer error:${err}`);
            this.fileSocket.close();
            this.eventHandle?.onError(err)
        });
        socket.on("close", async () => {
            await Util.delay(500);
            //通过已写入的大小判断是否完成传输
            if (this.fileSize != undefined) {
                if (this.writeStream != null && this.writeStream.bytesWritten >= this.fileSize) {
                    this.writeStream.end();
                    // this.writeStream.close();
                    logger.writeInfo(`File writer download success:${this.target}`);
                } else {
                    //传输失败 大小不一致
                    this.writeStream?.close();
                    fs.remove(this.target);
                    logger.writeWarn(`File download failed: file"${this.target}" raw size is ${this.fileSize} but downloaded size is ${this.writeStream?.bytesWritten}`)
                }
            } else {
                //?改成hash验证?
                //有点担心处理大文件时会有性能问题
                logger.writeDebug("Skipped file size verify");
            }
            logger.writeInfo(`Success download file:${this.target}`);
            this.fileSocket.close();
            this.writeStream?.close(()=>{
                setTimeout(() => {
                    this.eventHandle?.onSuccess(this.target);
                }, 150);
            });
            app.removeListener("before-quit", this.beforeQuit);
        })
    }
    private beforeQuit() {
        if (!this.writeStream?.closed) {
            this.writeStream?.close();
            fs.remove(this.target);
        }
    }
    setEventHandle(handle: FileWriterEventHandle): void {
        this.eventHandle = handle
    }
}
interface FileWriterEventHandle {
    onSuccess(file: string): void
    onError(err: Error): void
}
export default SocketFileWriter;
export {
    FileWriterEventHandle,
    SocketFileWriter
}