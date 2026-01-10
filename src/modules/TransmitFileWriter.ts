import net, { AddressInfo } from "net";
import fs from "fs-extra";
import { BrowserWindow, app } from "electron";
import Util from "./Util";
import crypto from "crypto";

class TransmitFileWriter {
    fileName: string;
    outputPath: string;
    fileSize: number;
    window: BrowserWindow;
    displayName: string;
    writeStream: null | fs.WriteStream;
    isVerified: boolean;
    fileSocket: net.Server;
    decipher: crypto.Decipher;
    private readonly LOG_TAG = "TransmitFileWriter";
    /**
     * @module
     * @param {String} fileName 文件名
     * @param {String} writeDir 文件路径
     * @param {number} fileSize 文件大小
     * @param {BrowserWindow} webContent 浏览器窗口 发信号用
     * @param {String} displayName 外显名称
     * @memberof TransmitFileWriter
     */
    constructor(fileName: string, writeDir: string, fileSize: number, webContent: BrowserWindow, displayName: string, encryptKeyBase64: string, encryptIvBase64: string) {
        this.fileName = fileName;
        this.outputPath = writeDir;
        this.fileSize = fileSize;
        this.window = webContent;
        this.displayName = displayName;
        /**
         * @instance
         * @type {fs.WriteStream|null}
         */
        this.writeStream = null;
        this.beforeQuit = this.beforeQuit.bind(this);
        //是否已通过验证
        this.isVerified = false;
        this.decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(encryptKeyBase64, "base64"), Buffer.from(encryptIvBase64, "base64"));
        this.decipher.setAutoPadding(true)
        this.fileSocket = net.createServer(socket => this.onConnectListener(socket));
        logger.writeInfo(`Writer instance created!`, this.LOG_TAG)
    }
    /**
     * @description 初始化 利用await等待开服完成
     */
    async init() {
        //结束前关闭流
        app.once("before-quit", this.beforeQuit)
        return new Promise<void>((resolve, reject) => {
            this.fileSocket.on("error", (err) => {
                logger.writeError(`Transmit file writer error:${err}`, this.LOG_TAG);
                reject(err);
            });
            //打开成功时回调
            this.fileSocket.listen(0, () => {
                //fs创流
                try {
                    this.writeStream = fs.createWriteStream(this.outputPath);
                    logger.writeInfo(`Transmit download file write at:${this.outputPath}`, this.LOG_TAG);
                } catch (error) {
                    logger.writeError(`Create transmit file write stream error:${error}`, this.LOG_TAG)
                    reject(error);
                    return
                }
                resolve();
            });
        })
    }
    onConnectListener(socket: net.Socket) {
        //定时器 防止验证超时
        const verifyTimer = setTimeout(() => {
            logger.writeWarn(`Transmit file writer connect timeout. file:${this.outputPath}`, this.LOG_TAG);
            socket.end();
            this.window.webContents.send("webviewEvent", "showAlert", { title: "上传文件失败", content: "客户端响应验证超时" });
            this.writeStream?.close();
            fs.remove(this.outputPath);
        }, 8000);
        socket.on("data", (data) => {
            //验证
            //第一个包必须是sessionId 
            //计时器 超时无响应直接失败
            if (!this.isVerified) {
                //只要收到验证响应就清除定时器
                clearTimeout(verifyTimer);
                //检查
                if (data.toString() === global.clientMetadata.sessionId) {
                    this.isVerified = true;
                    logger.writeInfo(`Transmit file writer session verify success:${data.toString()}`, this.LOG_TAG);
                    //通知ui创建文件项和进度条
                    this.window.webContents.send("webviewEvent", "transmitAppendFile", { displayName: this.displayName, size: this.fileSize, fileName: this.fileName });
                    //发送开始信号
                    //\r用于掐断readLine
                    if (!socket.destroyed) socket.write("START\r");
                    return
                } else {
                    logger.writeWarn(`Transmit file writer session verify failed:${data.toString()}`, this.LOG_TAG);
                    //不通过 关闭socket
                    if (!socket.destroyed) socket.end("VERIFY_FAILED\r");
                    //给前端信号显示消息
                    this.window.webContents.send("webviewEvent", "showAlert", { title: "上传文件失败", content: "传输验证失败" });
                    return
                }
            }
            //验证通过 后续数据解密并写入磁盘
            const decryptedData = this.decipher.update(new Uint8Array(data));
            if (this.writeStream?.write(decryptedData)) {
                this.window.setProgressBar(this.writeStream.bytesWritten / this.fileSize);
                this.window.webContents.send("fileUploadProgressUpdate", this.writeStream.bytesWritten);
            }
        });
        socket.on("error", err => {
            logger.writeError(`Transmit file writer error:${err}`, this.LOG_TAG);
            this.window.setProgressBar(-1);
            this.fileSocket.close();
        });
        socket.on("close", async () => {
            //aes填充
            const finalBlock = this.decipher.final();
            this.writeStream?.write(finalBlock);
            this.window.setProgressBar(1)
            await Util.delay(500);
            //通过已写入的大小判断是否完成传输
            if (this.writeStream != null && this.writeStream.bytesWritten >= this.fileSize) {
                this.writeStream.end();
                // this.writeStream.close();
                logger.writeInfo(`Transmit file writer download success:${this.outputPath}`, this.LOG_TAG);
                this.window.webContents.send("webviewEvent", "transmitFileUploadSuccess", this.fileName, this.displayName, null/* 占位 屎山来了 */, 0/* 手机 */);
            } else {
                //传输失败 大小不一致
                this.writeStream?.close();
                fs.remove(this.outputPath);
                logger.writeWarn(`Transmit file download failed: file"${this.outputPath}" raw size is ${this.fileSize} but downloaded size is ${this.writeStream?.bytesWritten}`, this.LOG_TAG)
                this.window.webContents.send("webviewEvent", "transmitFileTransmitFailed", { title: "接收失败", message: `文件"${this.fileName}"完整性校验失败` })
            }
            this.window.setProgressBar(-1)
            this.fileSocket.close();
            app.removeListener("before-quit", this.beforeQuit);
        })
    }
    private beforeQuit() {
        logger.writeDebug("Socket closed because application will quit", this.LOG_TAG);
        if (!this.writeStream?.closed) {
            this.writeStream?.close();
            fs.remove(this.outputPath);
        }
    }
    get port() {
        return (this.fileSocket.address() as AddressInfo).port
    }
}
export default TransmitFileWriter;