import net, { AddressInfo } from "net";
import { app } from 'electron';
import fs from "fs-extra";
import crypto from "crypto";
import Util from "./Util";
class SocketFileWriter {
    target: string;
    fileSize: number | null;
    isVerified: boolean;
    fileSocket: net.Server;
    writeStream: fs.WriteStream | undefined;
    eventHandle?: FileWriterEventHandle;
    filePath: string;
    decipher: crypto.Decipher;
    private readonly LOG_TAG = "SocketFileWriter";
    constructor(writeDir: string, filePath: string, fileSize: number | null, encryptKeyBase64: string, encryptIvBase64: string) {
        this.target = writeDir;
        this.fileSize = fileSize;
        this.isVerified = false;
        this.filePath = filePath;
        this.beforeQuit = this.beforeQuit.bind(this)
        this.fileSocket = net.createServer(socket => this.onConnection(socket));
        this.decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(encryptKeyBase64, "base64"), Buffer.from(encryptIvBase64, "base64"));
        this.decipher.setAutoPadding(true)
        logger.writeDebug("Socket file writer created", this.LOG_TAG);
    }
    async init() {
        //删除同名文件
        if (await fs.exists(this.target)) {
            logger.writeDebug(`File "${this.target}" exists, delete`, this.LOG_TAG);
            await fs.remove(this.target);
        }
        //退出前
        app.addListener("before-quit", this.beforeQuit);
        return new Promise<void>((resolve, reject) => {
            this.fileSocket.on("error", (err) => {
                logger.writeError(`Writer error:${err}`, this.LOG_TAG);
                reject(err);
            });
            this.fileSocket.listen(0, () => {
                // 创流
                try {
                    logger.writeDebug(`Writer listening port:${this.port}`, this.LOG_TAG);
                    fs.ensureDirSync(this.filePath);
                    this.writeStream = fs.createWriteStream(this.target);
                    this.writeStream.on("open", () => resolve());
                    logger.writeInfo(`File ready download at:${this.target}`, this.LOG_TAG);
                } catch (error) {
                    logger.writeError(`Create file write stream error:${error}`, this.LOG_TAG);
                    reject(error);
                    return
                }
            });
        })
    }
    private onConnection(socket: net.Socket) {
        logger.writeDebug("Writer socket connected", this.LOG_TAG);
        //验证
        const verifyTimer = setTimeout(() => {
            logger.writeWarn(`Writer connect timeout. file:${this.target}`, this.LOG_TAG);
            socket.end();
            this.writeStream?.close();
            fs.remove(this.target);
        }, 8000);
        //验证
        //第一个包必须是sessionID
        //计时器 超时无响应直接失败
        socket.on("data", (data: Buffer) => {
            if (!this.isVerified) {
                //只要收到验证响应就清除定时器
                clearTimeout(verifyTimer);
                //检查
                if (data.toString() === global.clientMetadata.sessionId) {
                    this.isVerified = true;
                    logger.writeInfo(`Writer session verify success:${data.toString()}`, this.LOG_TAG);
                    //发送开始信号
                    //\r用于掐断readLine
                    if (!socket.destroyed) socket.write("START\r");
                    return
                } else {
                    logger.writeWarn(`Writer session verify failed:${data.toString()}`, this.LOG_TAG);
                    //不通过 关闭socket
                    if (!socket.destroyed) socket.end("VERIFY_FAILED\r");
                    return
                }
            }
            // 通过 写入流
            const decryptedData = this.decipher.update(new Uint8Array(data));
            this.writeStream?.write(decryptedData);
        });
        socket.on("error", err => {
            logger.writeError(`File writer error:${err}`, this.LOG_TAG);
            this.fileSocket.close();
            this.eventHandle?.onError(err)
        });
        socket.on("close", async () => {
            //aes填充
            const finalBlock = this.decipher.final();
            this.writeStream?.write(finalBlock);
            await Util.delay(500);
            //通过已写入的大小判断是否完成传输
            if (this.fileSize != undefined) {
                if (this.writeStream != null && this.writeStream.bytesWritten >= this.fileSize) {
                    this.writeStream.end();
                    logger.writeInfo(`File writer download success:${this.target}`, this.LOG_TAG);
                } else {
                    //传输失败 大小不一致
                    this.writeStream?.close();
                    fs.remove(this.target);
                    logger.writeWarn(`File download failed: file"${this.target}" raw size is ${this.fileSize} but downloaded size is ${this.writeStream?.bytesWritten}`, this.LOG_TAG)
                }
            } else {
                //?改成hash验证?
                //有点担心处理大文件时会有性能问题
                logger.writeDebug("Skipped file size verify", this.LOG_TAG);
            }
            logger.writeInfo(`Success download file:${this.target}`, this.LOG_TAG);
            this.fileSocket.close();
            this.writeStream?.close(() => {
                setTimeout(() => {
                    this.eventHandle?.onSuccess(this.target);
                }, 150);
            });
            app.removeListener("before-quit", this.beforeQuit);
        })
    }
    private beforeQuit() {
        logger.writeDebug("Trigger before quit, closing", this.LOG_TAG);
        if (!this.writeStream?.closed) {
            this.writeStream?.close();
            fs.remove(this.target);
        }
    }
    setEventHandle(handle: FileWriterEventHandle): void {
        this.eventHandle = handle
    }
    get port() {
        return (this.fileSocket.address() as AddressInfo).port
    }
}
interface FileWriterEventHandle {
    onSuccess(file: string): void
    onError(err: Error): void
}
export {
    FileWriterEventHandle,
    SocketFileWriter
}