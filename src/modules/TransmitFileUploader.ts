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
    /**
     * Creates an instance of TransmitFileUploader.
     * @param {string} path 文件路径
     * @param {string} name 文件名
     * @param {{onCancel:Function,onSuccess:Function,onError:Function,onProgress:Function}} handle 
     * @memberof TransmitFileUploader
     */
    constructor(path: string, name: string, handle: { onCancel: Function; onSuccess: Function; onError: Function; onProgress: Function; }) {
        this.filePath = path;
        this.fileName = name;
        this.handle = handle;
        this.fileSize = fs.statSync(path).size;
        this.uploadSocket = null;
        logger.writeInfo("Transmit file uploader instance created");
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
            logger.writeInfo("Transmit file uploader device verify timeout");
            socket.close(4000);
            this.#close();
            this.handle.onCancel();
            this.handle.onError(new Error("手机端验证超时"));
        }, 8000);
        //发来数据 只有刚连上会有一次 验证用
        //验证并发送消息
        socket.on("message", (data) => {
            clearTimeout(verifyTimer);
            // TODO 改使用sessionId验证
            if (data.toString("utf-8") === global.clientMetadata.androidId) {
                logger.writeInfo(`Upload file device verify success`);
                //通过
                //输出完毕时执行
                //看能不能暴力修
                setTimeout(() => {
                    let sendedBytes = 0;
                    const wsStream = ws.createWebSocketStream(socket);
                    wsStream.on("pipe", src => {
                        src.on("data", data => {
                            sendedBytes += data.length;
                            this.handle.onProgress(sendedBytes);
                            if (sendedBytes >= this.fileSize) {
                                setTimeout(() => {
                                    this.fileStream?.removeAllListeners("data");
                                    // @ts-ignore
                                    for (const client of this.uploadSocket.clients) {
                                        client.close(1000, "success");
                                    }
                                    socket.close(1000, "success");
                                    this.uploadSocket?.close();
                                    this.fileStream?.close();
                                    logger.writeInfo(`Success upload file:${this.filePath}`);
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
                logger.writeWarn("Upload file device verify failed")
                this.handle.onError(new Error("验证不通过"));
            }
        });
    }
    #close() {
        // this.uploadSocket.close();
        logger.writeDebug("Transmit file uploader socket closed");
        this.fileStream?.close();
    }
    init() {
        app.once("before-quit", () => {
            //预留
            logger.writeDebug("Transmit file uploader socket closed because application was quit");
            this.#close();
        });
        return new Promise<number>(async (resolve, reject) => {
            try {
                if (!await fs.exists(this.filePath)) {
                    logger.writeError(`Transmit upload file not found:${this.filePath}`);
                    reject(new Error(`找不到文件${this.filePath}`));
                    return
                }
                this.fileStream = fs.createReadStream(this.filePath/* , { highWaterMark: 16384 } */);
                //准备好后打开服务器
                this.fileStream.once("readable", async () => {
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
                        logger.writeError(`Transmit file upload device connect timeout`)
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
                    logger.writeWarn("Transmit upload file read file timeout")
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