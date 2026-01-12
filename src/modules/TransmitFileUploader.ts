import fs from "fs-extra";
import { app } from "electron";
import ws from "ws";
import path from "path";
import { createServer } from "https";
import { AddressInfo } from "net";
class TransmitFileUploader {
    filePath: string;
    fileName: string;
    fileSize: number;
    handle: { onCancel: Function; onSuccess: Function; onError: Function; onProgress: Function; };
    uploadSocket: null | ws.Server;
    fileStream: fs.ReadStream | null = null;
    connectTimer: number | NodeJS.Timeout | null = null;
    private readonly LOG_TAG = "TransmitFileUploader";
    /**
     * @param {string} path 文件路径
     * @param {string} name 文件名
     */
    constructor(path: string, name: string, handle: { onCancel: Function; onSuccess: Function; onError: Function; onProgress: Function; }) {
        this.filePath = path;
        this.fileName = name;
        this.handle = handle;
        this.fileSize = fs.statSync(path).size;
        this.uploadSocket = null;
        logger.writeInfo("Transmit file uploader instance created",this.LOG_TAG);
    }
    /**
     * @param {ws} socket
     * @memberof TransmitFileUploader
     */
    #onConnection(socket: ws) {
        //清除超时计时器
        clearTimeout(this.connectTimer as number);
        //等待验证计时器
        const verifyTimer = setTimeout(() => {
            logger.writeInfo("Uploader device verify timeout",this.LOG_TAG);
            socket.close(4000);
            this.#close();
            this.handle.onCancel();
            this.handle.onError(new Error("手机端验证超时"));
        }, 8000);
        //发来数据 只有刚连上会有一次 验证用
        //验证并发送消息
        socket.on("message", (data) => {
            clearTimeout(verifyTimer);
            if (data.toString("utf-8") === global.clientMetadata.sessionId) {
                logger.writeInfo(`Upload file session verify success`,this.LOG_TAG);
                //通过
                //输出完毕时执行
                //看能不能暴力修
                setTimeout(() => {
                    let sendedBytes = 0;
                    const wsStream = ws.createWebSocketStream(socket);
                    logger.writeDebug("Start write file data",this.LOG_TAG);
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
                                    logger.writeInfo(`Success upload file:${this.filePath}`,this.LOG_TAG);
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
                this.#close();
                this.handle.onCancel();
                logger.writeWarn("Device verify failed",this.LOG_TAG)
                this.handle.onError(new Error("验证不通过"));
            }
        });
    }
    #close() {
        logger.writeDebug("Uploader socket closed",this.LOG_TAG);
        this.fileStream?.close();
    }
    init() {
        app.once("before-quit", () => {
            //预留
            logger.writeDebug("Uploader socket closed because application will quit",this.LOG_TAG);
            this.#close();
        });
        return new Promise<number>(async (resolve, reject) => {
            try {
                if (!await fs.exists(this.filePath)) {
                    logger.writeError(`Transmit upload file not found:${this.filePath}`,this.LOG_TAG);
                    reject(new Error(`找不到文件${this.filePath}`));
                    return
                }
                this.fileStream = fs.createReadStream(this.filePath/* , { highWaterMark: 16384 } */);
                //准备好后打开服务器
                this.fileStream.once("readable", async () => {
                    logger.writeDebug(`Transmit file upload ready`,this.LOG_TAG);
                    //清除超时检测
                    clearTimeout(timer);
                    //开服
                    const certPath = path.resolve(`${app.getPath("userData")}/programData/cert/`)
                    const server = createServer({
                        key: fs.readFileSync(path.resolve(`${certPath}/cert.key`)),
                        cert: fs.readFileSync(path.resolve(`${certPath}/cert.crt`))
                    }).listen(0);
                    this.uploadSocket = new ws.Server({ server });
                    this.uploadSocket.on("connection", (socket) => this.#onConnection(socket));
                    this.uploadSocket.once("error", () => this.#close());
                    //超时未连接
                    this.connectTimer = setTimeout(() => {
                        logger.writeError(`Transmit file upload device connect timeout`,this.LOG_TAG)
                        this.handle.onCancel();
                        this.#close();
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
                    logger.writeWarn("Transmit upload file read file timeout",this.LOG_TAG)
                    this.fileStream?.removeAllListeners("ready");
                    this.handle.onCancel();
                    reject(new Error("异常:打开文件超时"));
                    this.handle.onError(new Error("异常:打开文件超时"));
                }, 8000);
            } catch (error) {
                reject(error)
            }
        })
    }
}
export default TransmitFileUploader;