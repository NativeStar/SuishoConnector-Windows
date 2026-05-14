import fs from "fs-extra";
import { app } from "electron";
import ws from "ws";
import path from "path";
import { createServer } from "https";
import type { AddressInfo } from "net";
import type {FileUploaderEventHandle} from "../interface/FileUploaderEventHandle"
class TransmitFileUploader {
    filePath: string;
    fileSize: number;
    handle: FileUploaderEventHandle
    uploadSocket: null | ws.Server;
    fileStream: fs.ReadStream | null = null;
    connectTimer: number | NodeJS.Timeout | null = null;
    private cleanupFunction: () => void;
    private readonly LOG_TAG = "FileUploader";
    /**
     * @param {string} path 文件路径
     */
    constructor(path: string, handle: FileUploaderEventHandle) {
        this.filePath = path;
        this.handle = handle;
        this.fileSize = fs.statSync(path).size;
        this.uploadSocket = null;
        this.cleanupFunction = () => {
            logger.writeDebug("Uploader socket closed because application will quit", this.LOG_TAG);
            this.close();
        };
        logger.writeInfo("Transmit file uploader instance created", this.LOG_TAG);
    }
    /**
     * @param {ws} socket
     * @memberof TransmitFileUploader
     */
    private onConnection(socket: ws) {
        //清除超时计时器
        clearTimeout(this.connectTimer as number);
        //等待验证计时器
        const verifyTimer = setTimeout(() => {
            logger.writeInfo("Uploader device verify timeout", this.LOG_TAG);
            socket.close(4000);
            this.close();
            this.handle.onError(new Error("手机端验证超时"));
        }, 8000);
        //发来数据 只有刚连上会有一次 验证用
        //验证并发送消息
        socket.on("message", (data) => {
            clearTimeout(verifyTimer);
            if (data.toString("utf-8") === global.clientMetadata.sessionId) {
                logger.writeInfo(`Upload file session verify success`, this.LOG_TAG);
                //通过
                //输出完毕时执行
                //看能不能暴力修
                setTimeout(() => {
                    let sendedBytes = 0;
                    const wsStream = ws.createWebSocketStream(socket);
                    logger.writeDebug("Start write file data", this.LOG_TAG);
                    wsStream.on("pipe", src => {
                        src.on("data", data => {
                            sendedBytes += data.length;
                            this.handle.onProgress(sendedBytes);
                            if (sendedBytes >= this.fileSize) {
                                setTimeout(() => {
                                    this.fileStream?.removeAllListeners("data");
                                    for (const client of this.uploadSocket!.clients) {
                                        client.close(1000, "success");
                                    }
                                    socket.close(1000, "success");
                                    this.uploadSocket?.close();
                                    this.fileStream?.close();
                                    logger.writeInfo(`Success upload file:${this.filePath}`, this.LOG_TAG);
                                    this.handle.onSuccess();
                                }, 500);
                            }
                        })
                    })
                    this.fileStream?.pipe(wsStream, { end: false })
                }, 300);
            } else {
                //不通过
                socket.close(4000);
                this.close();
                logger.writeWarn("Device verify failed", this.LOG_TAG)
                this.handle.onError(new Error("验证不通过"));
            }
        });
    }
    private close() {
        logger.writeDebug("Uploader socket closed", this.LOG_TAG);
        this.fileStream?.close();
        app.removeListener("before-quit", this.cleanupFunction);
    }
    init() {
        app.once("before-quit", this.cleanupFunction);
        return new Promise<number>(async (resolve, reject) => {
            try {
                if (!await fs.exists(this.filePath)) {
                    logger.writeError(`File not found:${this.filePath}`, this.LOG_TAG);
                    reject(new Error(`找不到文件${this.filePath}`));
                    return
                }
                this.fileStream = fs.createReadStream(this.filePath/* , { highWaterMark: 16384 } */);
                //准备好后打开服务器
                this.fileStream.once("readable", async () => {
                    logger.writeDebug(`File upload ready`, this.LOG_TAG);
                    //清除超时检测
                    clearTimeout(timer);
                    //开服
                    const certPath = path.resolve(`${app.getPath("userData")}/programData/cert/`)
                    const server = createServer({
                        key: fs.readFileSync(path.resolve(`${certPath}/cert.key`)),
                        cert: fs.readFileSync(path.resolve(`${certPath}/cert.crt`))
                    }).listen(0);
                    this.uploadSocket = new ws.Server({ server });
                    this.uploadSocket.on("connection", (socket) => this.onConnection(socket));
                    this.uploadSocket.once("error", () => this.close());
                    //超时未连接
                    this.connectTimer = setTimeout(() => {
                        logger.writeError(`Transmit file upload device connect timeout`, this.LOG_TAG)
                        this.close();
                        reject(new Error("手机端超时未响应"));
                        this.handle.onError(new Error("手机端超时未响应"));
                    }, 5000);
                    server.once("listening", () => {
                        resolve((server.address() as AddressInfo).port);
                    });
                    //返回
                });
                //超时检测
                const timer = setTimeout(() => {
                    logger.writeWarn("Transmit upload file read file timeout", this.LOG_TAG)
                    this.fileStream?.removeAllListeners("ready");
                    this.handle.onError(new Error("异常:打开文件超时"));
                    reject(new Error("异常:打开文件超时"));
                }, 8000);
            } catch (error) {
                reject(error)
            }
        })
    }
}
export default TransmitFileUploader;