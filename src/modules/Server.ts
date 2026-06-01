import { type BrowserWindow as BrowserWindowType, app, ipcMain, type Tray } from "electron";
import type { IncomingMessage } from "http";
import https from "https";
import ws, { type AddressInfo } from "ws";
import randomThing from "randomthing-js";
import fs from "fs-extra";
import Util from "./Util";
import ResponseManager from "./ResponseManager";
import TransmitFileWriter from "./TransmitFileWriter";
import TransmitFileUploader from "./TransmitFileUploader";
import NotificationCore from "./NotificationCore";
import RequestId from "../constant/RequestId";
import ConnectionCloseCode from "../enum/ConnectionCloseCode";
import ConnectionCloseReasonString from "../constant/CloseCodeReasonString";
import path from "path";
import DeviceConfig from "./DeviceConfig";
import { type ApplicationListData } from "shared/index";
import { getTrayInstance } from "./Tray"
import { onNotificationForwardPacket, onSyncIconPackPacket, onTransmitPacket } from "./ServerPacketHandle";
declare global {
    var serverAddress: string | null
}
interface MainHandle {
    openMainWindow: () => void;
}
class Server {
    private LOG_TAG: string = "Server";
    pairToken: string;
    isConnectVerified: boolean;
    private readonly protocolVersion: number;
    phoneAddress: string | undefined = undefined;
    appWindow: BrowserWindowType;
    isInMainWindow: boolean;
    isClosed: boolean;
    showDefaultDisconnectAlert: boolean;
    mainHandle: MainHandle;
    notificationCore: NotificationCore | null;
    socket: ws | null;
    heartBeatDelay: { VERY_SLOW: number; SLOW: number; MEDIUM: number; HIGH: number; VERY_HIGH: number; };
    websocket: ws.Server<typeof ws, typeof IncomingMessage> | null = null;
    responseManager: ResponseManager | null = null;
    connectTimestamp: number = -1;
    connectTimeoutTimer: NodeJS.Timeout | number | null = null;
    handshakeTime: number = 0;
    private appListCache: Object | null = null;
    constructor(window: BrowserWindowType, onMessageMainCallbacks: MainHandle) {
        // 是否通过验证 协议版本等
        this.isConnectVerified = false;
        //客户端协议版本
        this.protocolVersion = 2;
        //窗口对象
        this.appWindow = window;
        //是否在主页面
        this.isInMainWindow = false;
        //是否已关闭 用于回调
        this.isClosed = false;
        //显示默认关闭连接弹窗
        this.showDefaultDisconnectAlert = true;
        //回调
        this.mainHandle = onMessageMainCallbacks;
        // 配对token
        this.pairToken = randomThing.number_en(64);
        /**
         * @description 通知管理核心
        */
        this.notificationCore = null
        /**
         * @type {ws}
        */
        this.socket = null;
        //设备数据
        global.clientMetadata = {
            androidSdkVersion: 0,
            protocolVersion: 0,
            model: "UnknownModel",
            oem: "UnknownOEM",
            clientVersionCode: 0,
            androidId: "failed",
            sessionId: randomThing.number_en(32)
        };
        //使toString无法被枚举 不然炸ipc
        Object.defineProperty(global.clientMetadata, "toString", {
            value: (): string => {
                logger.writeDebug("Client metadata custom toString called");
                let temp = "{"
                for (const key of Object.keys(global.clientMetadata)) {
                    if (key !== "toString") temp += `${key}:${global.clientMetadata[key as keyof typeof global.clientMetadata]},`
                };
                temp += "}";
                return temp;
            },
            enumerable: false
        });
        //心跳检测延迟
        this.heartBeatDelay = {
            VERY_SLOW: 60 * 1000,
            SLOW: 45 * 1000,
            MEDIUM: 30 * 1000,
            HIGH: 15 * 1000,
            VERY_HIGH: 5 * 1000,
        }
        try {
            //检查证书
            const certPath = path.resolve(`${app.getPath("userData")}/programData/cert/`)
            const server = https.createServer({
                key: fs.readFileSync(path.resolve(`${certPath}/cert.key`)),
                cert: fs.readFileSync(path.resolve(`${certPath}/cert.crt`))
            }).listen(0, "0.0.0.0");
            this.websocket = new ws.Server({ server });
            logger.writeInfo("Server launched");
        } catch (error: any) {
            //严重错误处理
            logger.writeError(error);
            import("electron").then(({ dialog }) => {
                dialog.showMessageBox(this.appWindow, {
                    title: "发生异常",
                    message: `出现致命异常,无法继续运行\n${error.stack}`,
                    buttons: ["重启", "关闭"],
                    cancelId: 1
                }).then(value => {
                    if (value.response === 0) {
                        logger.writeInfo("App relaunching because fatal error");
                        app.relaunch();
                    }
                    app.exit();
                })
            })
        };
        this.websocket!.on("connection", (socket, connectRequest) => {
            // 当已有成功连接时 禁止后续连接
            if (this.socket) {
                logger.writeInfo(`Reject new connection because already connected.Address: ${connectRequest.socket.remoteAddress}`);
                socket.close(ConnectionCloseCode.ConnectionAlreadyExists, ConnectionCloseReasonString[ConnectionCloseCode.ConnectionAlreadyExists])
                return
            }
            const pairTokenHeader = connectRequest.headers["suisho-pair-token"];
            if (pairTokenHeader !== this.pairToken) {
                logger.writeInfo(`Connection authorization failed.Address:${connectRequest.socket.remoteAddress}`);
                socket.close(ConnectionCloseCode.AuthorizationFailed, ConnectionCloseReasonString[ConnectionCloseCode.AuthorizationFailed])
                return
            }
            //返回值管理器
            this.responseManager = new ResponseManager(socket);
            //设置变量
            this.socket = socket;
            //已连接调用
            this.appWindow.webContents.send("connectPhone_connected");
            //保存发起连接时的时间戳
            this.connectTimestamp = Date.now();
            //8秒超时计时器
            this.connectTimeoutTimer = setTimeout(() => {
                logger.writeWarn("Device connect timeout");
                //断开连接
                this.close(false);
                this.appWindow.webContents.send("connectPhone_connectFailed", "设备响应超时");
            }, 8000);
            socket.on("message", (data, isBinary) => this.onSocketMessage(data, isBinary, socket));
            socket.on("close", (code, reason) => { this.onSocketClose(code, reason) });
            this.phoneAddress = connectRequest.socket.remoteAddress;
            logger.writeInfo(`Receive connection from ${connectRequest.socket.remoteAddress}`);
            //退出前收尾
            // app.once("before-quit",()=>{this.beforeApplicationQuit()});
            this.checkHeartBeat(socket);
            this.initWebviewHandles(socket);
            setTimeout(() => {
                logger.writeInfo("create app list cache on launch", this.LOG_TAG);
                this.createAppListCache();
            }, 5000);
        });

    }
    close(showDisconnectAlert = true) {
        logger.writeInfo("Server close");
        this.showDefaultDisconnectAlert = showDisconnectAlert;
        //挨个调用close 不然安卓端会触发连接失败的回调
        for (const client of this.websocket!.clients) {
            client.close(ConnectionCloseCode.CloseFromServer, "Closed by server");
        }
        //彻底关闭
        this.websocket!.close();
    }
    private async createAppListCache() {
        this.appListCache = await this.responseManager?.send({ packetType: "main_queryAllPackages" }) as Object;
    }
    /**
     * @description 连接信息处理
     */
    private async onSocketMessage(data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean, socket: ws) {
        let jsonObj;
        try {
            //二进制数据无法转换
            if (isBinary) {
                logger.writeError("Cannot convert binary data")
                throw "Cannot convert binary data"
            }
            jsonObj = JSON.parse(data.toString());
        } catch (error: any) {
            logger.writeError(`Convert json failed:${error.message}`);
            //关闭连接
            this.close(false);
            clearTimeout(<number>this.connectTimeoutTimer);
            this.appWindow.webContents.send("connectPhone_connectFailed", "设备发送了破损的数据包");
            return
        }
        //检查是否已验证
        if (!this.isConnectVerified) {
            //如果不是握手包
            if (jsonObj.packetType !== "connect_handshake") {
                logger.writeWarn("Not a handshake packet");
                this.close(false);
                clearTimeout(<number>this.connectTimeoutTimer);
                this.appWindow.webContents.send("connectPhone_connectFailed", "未按协议进行数据提交");
                return
            }
        }
        //是握手包往下执行
        //pc端版本低于安卓端
        //暂时不搞 不知道版本差在未来会怎么样
        // if (this.protocolVersion<jsonObj.protocolVersion) {
        // }
        //是否为返回数据包
        if (jsonObj._isResponsePacket === true) {
            logger.writeDebug("Receive a response packet");
            //丢给返回值管理器
            this.responseManager!.onResponseMessage(jsonObj._responseId, jsonObj);
            return
        }
        logger.writeDebug(`Received a packet.Type:${jsonObj.packetType}`);
        switch (jsonObj.packetType) {
            //连接握手包
            case "connect_handshake":
                //检查连接时间戳 是否超时
                //连接时间+8大于当前时间即超时 不继续操作
                const time = Date.now();
                if ((this.connectTimestamp + 8000) < time) return
                this.handshakeTime = time;
                this.isConnectVerified = true;
                //清除旧定时器
                clearTimeout(<number>this.connectTimeoutTimer);
                //握手包
                const os = await import("os");
                socket.send(JSON.stringify({ packetType: "connect_ping", msg: global.config.deviceId, name: os.hostname(), time: Date.now() }));
                //重设定时器
                this.connectTimeoutTimer = setTimeout(() => {
                    logger.writeWarn("Device handshake timeout")
                    this.close(false);
                    this.appWindow.webContents.send("connectPhone_connectFailed", "设备响应超时");
                }, 8000);
                logger.writeInfo("Device handshake start");
                break
            case "connect_handshake_pong":
                //清除定时器
                clearTimeout(<number>this.connectTimeoutTimer);
                //握手返回的数据
                //设置全局
                // 检查androidId
                if (!/^[A-Za-z0-9_-]{8,64}$/.test(jsonObj.androidId)) {
                    this.close(false);
                    this.appWindow.webContents.send("connectPhone_connectFailed", "设备ID异常");
                    logger.writeWarn("Device androidId invalid");
                    return
                }
                global.clientMetadata.androidSdkVersion = jsonObj.androidVersion
                global.clientMetadata.protocolVersion = jsonObj.protocolVersion
                global.clientMetadata.model = jsonObj.modelName;
                global.clientMetadata.oem = jsonObj.oem;
                global.clientMetadata.androidId = jsonObj.androidId;
                global.clientMetadata.clientVersionCode = jsonObj.clientVersionCode ?? 0;
                //检查时间 如果从首次握手到完成不足350ms就将延迟拉到350ms
                //不然一下子闪过去太诡异了
                /*虽然正常这点东西不会拖那么久的*/
                const connectTime = Date.now();
                //设备配置管理器
                global.deviceConfig = new DeviceConfig(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/config/device.json`, jsonObj.modelName);
                if ((connectTime - this.handshakeTime) < 350) {
                    logger.writeDebug("Device handshake success in 500ms");
                    setTimeout(() => {
                        //完成连接 把网络service转为前台服务
                        socket.send(JSON.stringify({ packetType: "connect_success", msg: global.serverAddress, sessionId: global.clientMetadata.sessionId, protocolVersion: this.protocolVersion }));
                        //打开主页面
                        this.mainHandle.openMainWindow();
                        this.isInMainWindow = true;
                        //防止未知原因的无法显示
                    }, 350 - (connectTime - this.handshakeTime));
                } else {
                    logger.writeDebug("Device handshake success out of 350ms");
                    //超过500ms直接执行
                    socket.send(JSON.stringify({ packetType: "connect_success", msg: global.serverAddress, sessionId: global.clientMetadata.sessionId }));
                    this.mainHandle.openMainWindow();
                    this.isInMainWindow = true;
                    //防止未知原因的无法显示
                    setTimeout(() => {
                        if (!this.appWindow.isDestroyed()) {
                            this.appWindow.show()
                        }
                    }, 350);
                }
                this.notificationCore = new NotificationCore(this);
                this.scheduleDisposableTask();
                logger.writeDebug(`Device android version:${global.clientMetadata.androidSdkVersion} protocolVersion:${global.clientMetadata.protocolVersion} model:${global.clientMetadata.model} clientVersion:${global.clientMetadata.clientVersionCode}`)
                break
            case "action_transmit":
                onTransmitPacket(jsonObj, this.appWindow, socket);
                break
            case "action_notificationForward":
                onNotificationForwardPacket(jsonObj, this.notificationCore);
                break
            case "syncIconPack"://同步应用图标资源包
                onSyncIconPackPacket(jsonObj, socket, this.appWindow);
                break
            case "trustModeChange":
                //设备信任模式切换
                logger.writeInfo(`Trust mode changed to:${jsonObj.trusted ? "trusted" : "untrusted"}`);
                this.appWindow.webContents.send("webviewEvent", "trustModeChange", jsonObj.trusted)
                break
            case "updateDeviceState":
                //更新tray
                const tray = getTrayInstance();
                if (tray) {
                    jsonObj.charging ? tray.setToolTip(`Suisho Connector-${jsonObj.batteryLevel}%`) : tray.setToolTip(`Suisho Connector`);
                }
                //更新前端设备状态 电量 温度显示等
                this.appWindow.webContents.send("webviewEvent", "updateDeviceState", jsonObj);
                break
            case "edit_state":
                logger.writeDebug(`New edit state packet:${jsonObj.type} ${jsonObj.name}`);
                this.appWindow.webContents.send("webviewEvent", "editState", { type: jsonObj.type, id: jsonObj.name });
                break
            case "removeActiveNotification":
                logger.writeDebug(`New remove active notification packet:${jsonObj.key}`);
                this.appWindow.webContents.send("webviewEvent", "currentNotificationUpdate", { type: "remove", key: jsonObj.key });
                break
            case "updateMediaSessionMetadata":
                logger.writeDebug(`New update media session metadata packet:${jsonObj.title} ${jsonObj.artist} ${jsonObj.album}`);
                this.appWindow.webContents.send("webviewEvent", "updateMediaSessionMetadata", jsonObj);
                break
            case "updateMediaSessionPlaybackState":
                logger.writeDebug(`New update media session playback state packet`);
                this.appWindow.webContents.send("webviewEvent", "updateMediaSessionPlaybackState", jsonObj);
                break
            case undefined:
            case null:
                //无packetType属性
                logger.writeWarn("Missing packet type");
                break
            default:
                //检查协议版本
                logger.writeWarn(`Invalid packet type:${jsonObj.packetType}`);
        }
        /* 要在clients里挨个调用close手机端才能不报错 */

    }
    /**
     *@description 断开连接时回调
     */
    onSocketClose(code: number, reason: Buffer) {
        if (this.isClosed) return
        this.isClosed = true;
        const reasonString = reason.toString("utf-8");
        if (!this.appWindow.isDestroyed()) this.appWindow.flashFrame(true);
        //如果关闭了默认弹窗则不往下执行
        if (!this.showDefaultDisconnectAlert) return
        logger.writeInfo(`Server socket closed`);
        //检查窗口是否显示 不可显示则发送通知
        if (!this.appWindow.isDestroyed() && !this.appWindow.isVisible()) {
            //直接用Electron自带通知
            const canSendXmlNotification = Util.hasStartMenuShortcut();
            logger.writeInfo(`Post device disconnect notification with ${canSendXmlNotification ? "xml" : "vanilla"}`);
            import("electron").then(({ Notification }) => {
                const notification = new Notification({
                    title: canSendXmlNotification ? "suisho_disconnect_notification_placeholder" : "连接中断",
                    body: canSendXmlNotification ? "suisho_disconnect_notification_placeholder" : `${global.clientMetadata.model}已断开连接`,
                    toastXml:
                        `
                <toast activationType="protocol" launch="suisho:clickNotification">
                    <visual>
                        <binding template="ToastGeneric">
                            <text>连接中断</text>
                            <text>${global.clientMetadata.model}已断开连接</text>
                        </binding>
                    </visual>
                </toast>
                `
                });
                !canSendXmlNotification && notification.on("click", _event => {
                    if (this.appWindow !== null && !this.appWindow.isDestroyed()) {
                        this.appWindow.show();
                        if (this.appWindow.isMinimized()) {
                            this.appWindow.restore();
                        }
                        this.appWindow.focus();
                    }
                    notification.close();
                });
                notification.show();
            })
        }
        //只留下主窗口
        import("electron").then(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows().forEach(window => {
                if (!window.title.startsWith("Suisho Connector:")) {
                    //如果这些窗口在焦点 则将主窗口拉起
                    if (window.isFocused()) {
                        this.appWindow.show();
                        if (this.appWindow.isMinimized()) {
                            this.appWindow.restore();
                        }
                        this.appWindow.focus();
                    }
                    window.close();
                }
            });
        })
        //关闭窗口时会触发 但窗口已经关闭了 所以会报错
        //判断窗口
        if (this.isInMainWindow) {
            const reasonStr = ConnectionCloseReasonString[code as ConnectionCloseCode] ?? "由于未知异常 连接断开";
            if (!this.appWindow.isDestroyed()) {
                this.appWindow.webContents.send("webviewEvent", "disconnect", reasonStr)
                if (this.appWindow.isFullScreen()) {
                    this.appWindow.setFullScreen(false);
                    this.appWindow.setResizable(false)
                }
            }
            return
        }
        try {
            this.appWindow.webContents.send("connectPhone_connectFailed", reasonString === "" ? "与移动端连接已断开" : reasonString);
        } catch (error) {
            logger.writeError(`Send socket closed message to renderer process failed:${error}`);
        };

    }
    /**
     * @description 连接心跳检测
     */
    async checkHeartBeat(socket: ws) {
        //检测计时器
        let beatTimer: null | number | NodeJS.Timeout;
        //发起ping时间戳
        let pingTime: number = Date.now();
        const onPong = async () => {
            //接受到信号 移除计时器
            clearTimeout(<number>beatTimer);
            //计算延迟
            if (!this.appWindow.isDestroyed()) {
                this.appWindow.webContents.send("webviewEvent", "updateNetworkLatency", Date.now() - pingTime);
            }
            //延迟
            await Util.delay(this.heartBeatDelay[global.config.heartBeatDelay as keyof typeof this.heartBeatDelay] ?? 60000);
            //设置计时器
            logger.writeDebug("Received pong packet")
            beatTimer = setTimeout(() => {
                logger.writeInfo("Pong packet timeout.Android client dead");
                //关闭连接
                this.close();
                //移除监听
                socket.removeListener("pong", onPong);
                //手动触发回调
                this.onSocketClose(ConnectionCloseCode.CloseHeartBeatTimeout, Buffer.allocUnsafe(1));
            }, 30 * 1000);
            //发起ping
            pingTime = Date.now();
            socket.ping();
        }
        //设置回调
        socket.on("pong", onPong);
        //发起首次ping
        logger.writeDebug("Heartbeat polling start");
        socket.ping();
    }

    /**
     * @description 设置BrowserWindow对象
     */
    setWindow(bw: BrowserWindowType) {
        this.appWindow = bw;
        this.notificationCore?.setWindow(bw);
        logger.writeDebug("Server set main window instance");
    }
    getNotificationManager() {
        return this.notificationCore;
    }
    private async scheduleDisposableTask() {
        //清理无用通知转发profile
        const { powerMonitor } = await import("electron")
        const autoCleanupAppProfileTask = setInterval(() => {
            const idleTime = powerMonitor.getSystemIdleTime();
            logger.writeDebug(`Idle time:${idleTime}`);
            //设备无操作5分钟
            if (idleTime > 300 && this.appListCache && this.notificationCore) {
                this.notificationCore.cleanupProfile(this.appListCache as { data: ApplicationListData[] }).catch(error => {
                    logger.writeError(`Cleanup app profile failed:${error}`);
                });
                clearInterval(autoCleanupAppProfileTask);
            }
        }, 60 * 1000);
        //检查右键菜单设置
        setImmediate(() => {
            global.config.enableFileContextMenu ? Util.registerContextMenu() : Util.unregisterContextMenu();
            logger.writeDebug("Update file context menu status");
        })
    }
    /**
     * @description 跨进程消息处理
     */
    async initWebviewHandles(socket: ws) {
        ipcMain.handle("main_getDeviceDetailInfo", async (_event) => {
            try {
                return await this.responseManager?.send({ packetType: "main_getDeviceDetailInfo" });
            } catch (error) {
                logger.writeError(`Failed init webview handle:${error}`)
                return new Promise((_resolve, reject) => {
                    reject(error);
                })
            }
        });
        //发包 无响应
        ipcMain.handle("main_sendPacket", (_event, data: string | Object) => {
            //允许直接发送对象
            logger.writeDebug("Renderer send a packet");
            if (data instanceof Object) {
                socket.send(JSON.stringify(data));
                return
            }
            socket.send(data)
        });
        ipcMain.handle("main_sendRequestPacket", async (_event, data: Object): Promise<any> => {
            logger.writeDebug("Renderer send a request packet");
            if (data instanceof Object) {
                return await this.responseManager?.send(data as any);
            }
            //非对象不可发送
            logger.writeError(`Request packet data must an Object,but data type is ${typeof data}`);
            return null;
        });
        //互传pc上传文件
        ipcMain.handle("transmit_uploadFile", async (_event, name, path, size, form) => {
            try {
                let uploader: TransmitFileUploader | null = new TransmitFileUploader(path, {
                    onProgress: (value: number) => {
                        this.appWindow.webContents.send("fileUploadProgressUpdate", value);
                    },
                    //完成 只需要释放资源
                    onSuccess: () => {
                        logger.writeInfo("Transmit upload file success");
                        this.appWindow.webContents.send("webviewEvent", "transmitFileUploadSuccess", name, name, 1, form === undefined ? 0 : form);
                    },
                    //失败时执行 throw可能抓不到
                    onError: (error: { message: any; }) => {
                        this.responseManager?.cancel(RequestId.REQUEST_TRANSMIT_COMPUTER_UPLOAD_FILE);
                        logger.writeError(`Transmit upload file failed:${error}`);
                        this.appWindow.webContents.send("webviewEvent", "transmitFileTransmitFailed", { title: "上传失败", message: error.message })
                    }
                });
                const uploaderPort = await uploader.init();
                await this.responseManager?.send({ packetType: "transmit_uploadFile", port: uploaderPort, fileName: name, _request_id: RequestId.REQUEST_TRANSMIT_COMPUTER_UPLOAD_FILE, fileSize: size });
                logger.writeInfo("Transmit upload file start");
            } catch (error: any) {
                logger.writeError(`Upload file failed:${error}`);
                this.appWindow.webContents.send("webviewEvent", "transmitFileTransmitFailed", { title: "上传失败", message: error.message });
            }
        });
        ipcMain.handle("notificationForward_getPackageList", async (_event, forceRefresh: boolean = false) => {
            if (!forceRefresh && this.appListCache) {
                logger.writeDebug("Load package list from cache")
                return this.appListCache;
            }
            await this.createAppListCache();
            logger.writeDebug("Load package list from realtime")
            return this.appListCache;
        });
        ipcMain.handle("mediaSession_appendAction", (_event, action, time) => {
            logger.writeDebug(`Media session append action:${action}`)
            socket.send(JSON.stringify({ packetType: "appendMediaSessionControl", msg: action, time }))
        });
        ipcMain.handle("transmit_deleteTransmitFile", (_event, fileName) => {
            logger.writeDebug(`Transmit request delete file:${fileName}`)
            const baseFileName = path.basename(fileName);
            // 不需要返回值 懒得做提醒
            try {
                fs.rm(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${baseFileName}`)
            } catch (e) {
                logger.writeWarn(`Transmit delete file error:${e}`)
            }
        });
    }
    get clients() {
        return this.websocket?.clients
    }
    private getAddressInfo(): AddressInfo | null {
        const addr = this.websocket?.address() ?? null;
        if (!addr || typeof addr === "string") return null;
        return addr;
    }
    async getPortAsync(): Promise<number> {
        const info = this.getAddressInfo();
        if (info) return info.port;
        await new Promise<void>((resolve, reject) => {
            if (!this.websocket) return reject(new Error("WebSocketServer not initialized"));
            const cleanup = () => {
                this.websocket?.off("listening", onListening);
                this.websocket?.off("error", onError);
            };
            const onListening = () => { cleanup(); resolve(); };
            const onError = (err: Error) => { cleanup(); reject(err); };
            this.websocket.once("listening", onListening);
            this.websocket.once("error", onError);
            logger.writeDebug("Waiting for server to start to get port");
        });
        const newInfo = this.getAddressInfo();
        if (!newInfo) throw new Error("Server listening but address unavailable");
        return newInfo.port;
    }
    getPhoneAddress(): string {
        return this.phoneAddress as string;
    }
}
export default Server;