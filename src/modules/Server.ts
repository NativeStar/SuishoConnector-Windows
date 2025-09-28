import { BrowserWindow, dialog, app, ipcMain, Notification, session } from "electron";
import { IncomingMessage } from "http";
import https from "https";
import ws from "ws";
import randomThing from "randomthing-js";
import fs from "fs-extra";
import Util from "./Util";
import RM from "./ResponseManager";
import TransmitFileWriter from "./TransmitFileWriter";
import TransmitFileUploader from "./TransmitFileUploader";
import NotificationCore from "./NotificationCore";
import RequestId from "../constant/RequestId";
import os from "os";
import ConnectionCloseCode from "../enum/ConnectionCloseCode";
import ConnectionCloseReasonString from "../constant/CloseCodeReasonString";

import path from "path";
import nodeStreamZip from "node-stream-zip";
import { SocketFileWriter } from "./SocketFileWriter";
declare global {
    var serverAddress: string | null
}
interface mainHandle {
    openMainWindow: Function
}
class Server {
    private LOG_TAG:string = "Server";
    isConnectVerified: boolean;
    protocolVersion: number;
    phoneAddress: string | undefined = undefined;
    appWindow: BrowserWindow;
    isInMainWindow: boolean;
    isClosed: boolean;
    showDefaultDisconnectAlert: boolean;
    mainHandle: mainHandle;
    notificationCore: NotificationCore | null;
    socket: ws | null;
    heartBeatDelay: { VERY_SLOW: number; SLOW: number; MEDIUM: number; HIGH: number; VERY_HIGH: number; REALTIME: number; };
    websocket: ws.Server<typeof ws, typeof IncomingMessage> | null = null;
    responseManager: RM | null = null;
    connectTimestamp: number = -1;
    connectTimeoutTimer: NodeJS.Timeout | number | null = null;
    handshakeTime: number = 0;
    private appListCache:Object|null=null;
    /**
     * Creates an instance of server.
     * @param {number} port
     * @param {BrowserWindow} window
     * @param {Function} onMessageMainCallbacks 回调
     * @memberof server
     */
    constructor(port: number, window: BrowserWindow, onMessageMainCallbacks: mainHandle) {
        // 是否通过验证 协议版本等
        this.isConnectVerified = false;
        //客户端协议版本
        this.protocolVersion = 1;
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
        /**
         * @description 通知管理核心
         * @type {NotificationCore}
        */
       this.notificationCore = null
       /**
        * @type {ws}
       */
      this.socket = null;
        //设备数据
        global.clientMetadata = {
            android: 0,
            protocolVersion: 0,
            model: "UnknownModel",
            oem: "UnknownOEM",
            androidId: "failed",
            sessionId: randomThing.number_en(32)
        };
        //使toString无法被枚举 不然炸ipc
        Object.defineProperty(global.clientMetadata, "toString", {
            value: function (): string {
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
            // 预留
            REALTIME: 1 * 1000
        }
        try {
            //检查证书
            const certPath = path.resolve(`${app.getPath("userData")}/programData/cert/`)
            const server = https.createServer({
                key: fs.readFileSync(path.resolve(`${certPath}/cert.key`)),
                cert: fs.readFileSync(path.resolve(`${certPath}/cert.crt`))
            }).listen(port, "0.0.0.0");
            this.websocket = new ws.Server({ server });
            logger.writeInfo("Server launched");
        } catch (error: any) {
            //严重错误处理
            logger.writeError(error);
            dialog.showMessageBox(this.appWindow, {
                title: "发生内部异常",
                message: `程序致命异常,无法继续运行\n${error.stack}`,
                buttons: ["重启", "关闭"],
                cancelId: 1
            }).then(value => {
                if (value.response === 0) app.relaunch();
                app.exit();
            })
        };
        // this.websocket!.setMaxListeners(1);
        this.websocket!.on("connection", (socket, connectRequest) => {
            //返回值管理器
            this.responseManager = new RM(socket);
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
            ipcMain.handle("debug_fakeMessage", (event, data: Buffer | Buffer | ArrayBuffer) => {
                this.onSocketMessage(data, false, socket)
            });
            this.phoneAddress = connectRequest.socket.remoteAddress;
            logger.writeDebug(`Receive connection from ${connectRequest.socket.remoteAddress}`);
            //退出前收尾
            // app.once("before-quit",()=>{this.beforeApplicationQuit()});
            this.checkHeartBeat(socket);
            this.initWebviewHandles(socket);
            setTimeout(() => {
                logger.writeInfo("create app list cache on launch",this.LOG_TAG);
                this.createAppListCache();
            }, 5000);
            // this.notificationCore=new NotificationCore();
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
    private async createAppListCache(){
        this.appListCache=await this.responseManager?.send({ packetType: "main_queryAllPackages" }) as Object;
    }
    /**
     * @description 连接信息处理
     */
    private async onSocketMessage(data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean, socket: ws) {
        // console.log("message");
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
            this.appWindow.webContents.send("connectPhone_connectFailed", "异常数据包");
            return
        }
        //检查是否已验证
        if (!this.isConnectVerified) {
            //如果不是握手包
            if (jsonObj.packetType !== "connect_handshake") {
                logger.writeError("Not a handshake packet");
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
        logger.writeDebug(`Receive a packet.Type:${jsonObj.packetType}`);
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
                socket.send(JSON.stringify({ packetType: "connect_ping", msg: global.config.deviceId, name: os.hostname(), time: Date.now()}));
                //重设定时器
                this.connectTimeoutTimer = setTimeout(() => {
                    logger.writeError("Device handshake timeout")
                    this.close(false);
                    this.appWindow.webContents.send("connectPhone_connectFailed", "设备响应超时");
                }, 8000);
                break
            case "connect_handshake_pong":
                //清除定时器
                clearTimeout(<number>this.connectTimeoutTimer);
                //握手返回的数据
                //设置全局
                //TODO 改用TargetAPI识别 这直接读字符串未免离谱了点
                global.clientMetadata.android = parseFloat(jsonObj.androidVersion);
                global.clientMetadata.protocolVersion = jsonObj.protocolVersion
                global.clientMetadata.model = jsonObj.modelName;
                global.clientMetadata.oem = jsonObj.oem;
                global.clientMetadata.androidId = jsonObj.androidId;
                //检查时间 如果从首次握手到完成不足350ms就将延迟拉到350ms
                //不然一下子闪过去太诡异了
                /*虽然正常这点东西不会拖那么久的 除非你网废了*/
                const connectTime = Date.now();
                if ((connectTime - this.handshakeTime) < 350) {
                    logger.writeDebug("Device handshake success in 500ms");
                    setTimeout(() => {
                        //完成连接 把网络service转为前台服务
                        socket.send(JSON.stringify({ packetType: "connect_success", msg: global.serverAddress, sessionId: global.clientMetadata.sessionId }));
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
                this.notificationCore = new NotificationCore();
                break
            case "action_transmit":
                logger.writeDebug(`A transmit message packet type is ${jsonObj.messageType}`);
                //处理文件等
                switch (jsonObj.messageType) {
                    case "planeText":
                        this.appWindow.webContents.send("webviewEvent", "transmit_appendPlainText", jsonObj.data);
                        break;
                    case "file":
                        //文件存储路径
                        const fileDirPath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`;
                        //检查是否有文件重名
                        const dirFileList = await fs.readdir(fileDirPath);
                        //先正常赋值 之后检查重名
                        jsonObj.displayName = jsonObj.name;
                        for (const dirFileName of dirFileList) {
                            if (dirFileName === jsonObj.name) {
                                //有重名
                                //设置显示名称 尝试逃过浅拷贝
                                jsonObj.displayName = `${jsonObj.name}`;
                                //改为文件原名+时间戳+原后缀
                                //文件有后缀名
                                if (jsonObj.name.lastIndexOf(".") !== -1) {
                                    jsonObj.name = jsonObj.name.slice(0, jsonObj.name.lastIndexOf(".")) + "_" + Date.now().toString() + jsonObj.name.slice(jsonObj.name.lastIndexOf("."), jsonObj.name.length);
                                } else {
                                    //无后缀名
                                    jsonObj.name = jsonObj.name + Date.now().toString();
                                }
                                //检查文件名长度
                                if (jsonObj.name.length > 255) {
                                    //直接改成时间戳文件名 不管打开了
                                    jsonObj.name = Date.now().toString();
                                }
                                logger.writeDebug(`Transmit file auto rename because file name repeat:"${jsonObj.displayName}"=>"${jsonObj.name}"`)
                                break
                            }
                        }
                        //检查Windows系统文件名保留字
                        if (Util.detectWindowsReservedWords(jsonObj.name)) {
                            logger.writeWarn(`Transmit File name unavailable by Windows reserved words`)
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: "该文件名因操作系统限制不可使用" }));
                            return
                        }
                        //文件大小检查 -1为无效
                        if (jsonObj.size === -1) {
                            logger.writeWarn("Receive file size error");
                            this.appWindow.webContents.send("webviewEvent", "showAlert", "接收文件异常", "异常文件\n请检查文件是否存在或为特殊类型\n也可能是软件Bug");
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: "异常文件\n请检查文件是否存在或为特殊类型\n也可能是软件Bug" }));
                            return
                        }
                        await fs.ensureDir(fileDirPath);
                        const fileSocket = this.createTransmitFileSocket(jsonObj.name, `${fileDirPath}${jsonObj.name}`, jsonObj.size, this.appWindow, jsonObj.displayName, jsonObj.encryptKey, jsonObj.encryptIv);
                        //如果返回值是错误对象
                        if (fileSocket instanceof ReferenceError) {
                            logger.writeError(`Transmit failed to create file socket:${fileSocket}`);
                            this.appWindow.webContents.send("webviewEvent", "showAlert", "接收文件异常", fileSocket.stack);
                            //通知安卓端
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: `PC端发生异常\n${fileSocket.stack}` }));
                            return
                        }
                        //等待初始化完成
                        try {
                            await fileSocket.init();
                            logger.writeDebug("Transmit file init success");
                        } catch (error: any) {
                            logger.writeError(`Init transmit file socket failed:${error}`);
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: `内部异常:创建文件输出流失败\n${error.stack}` }));
                            return
                        }
                        socket.send(JSON.stringify({ _responseId: jsonObj._requestId, port: fileSocket.port, _result: "SUCCESS" }));
                        break
                    default:
                        logger.writeWarn(`Unknown transmit message type:${jsonObj.messageType}`);
                        break;
                }
                break
            case "action_createFile":
                //创建文件
                //互传创建
                if (jsonObj.createType === "transmit") {
                    (async () => {
                        //检查重名
                        const fileList = await fs.readdir(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`);
                        if (fileList.some((value) => {
                            return jsonObj.name === value
                        })) {
                            logger.writeInfo("Cannot create name repeated file");
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, state: false, msg: "无法传输重名的空文件" }));
                            return
                        }
                        try {
                            await fs.createFile(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/${jsonObj.name}`);
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, state: true }));
                            logger.writeInfo(`Transmit success create file:${jsonObj.name}`)
                        } catch (error: any) {
                            //创建失败
                            logger.writeError(`Transmit failed create file:${jsonObj.name}`)
                            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, state: false, msg: error.message }));
                        }
                    })();
                    //自由创建 用于后面文件管理
                } else if (jsonObj.createType === "empty") {
                    //*预留
                }
                break
            case "action_notificationForward":
                if (!global.deviceConfig.enableNotification) break
                this.notificationCore?.onNewNotification(jsonObj.package, jsonObj.time, jsonObj.title, jsonObj.content, jsonObj.appName, jsonObj.ongoing);
                break
            case "syncIconPack"://同步应用图标资源包
                const filePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/iconArchive`;
                const extractDir = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/iconCache/`;
                //检查摘要
                //要本地有文件同时安卓端发来hash
                //文本中存hash 包文件解压完就删
                if (await fs.pathExists(extractDir) && await fs.exists(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`)) {
                    const hash: string = await fs.readFile(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`, { encoding: "utf-8" });
                    logger.writeDebug(`Icon pack hash detail\nLocal:${hash}\nAndroid client:${jsonObj.hash}`)
                    if (hash === jsonObj.hash) {
                        //文件相同 无需更新
                        logger.writeInfo(`Need not update icon pack with same hash:${hash}`);
                        socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: "NEED_NOT" }));
                        return
                    }
                }
                logger.writeDebug("Starting download icon pack");
                const fileSocket = this.createFileSocket(filePath, `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/`);
                if (fileSocket instanceof ReferenceError) {
                    logger.writeError(`Failed to create file socket:${fileSocket}`);
                    //通知安卓端
                    socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR" }));
                    return
                }
                try {
                    await fileSocket.init();
                    //不放在这发送事件时窗口更替还没完成 会崩溃
                    this.appWindow.webContents.send("webviewEvent", "add_state", "busy_waiting_icon_pack");
                    fileSocket.setEventHandle({
                        onError: (err) => {
                            logger.writeWarn(`Failed to download application icons pack\n${err}`);
                        },
                        onSuccess: async (file: string) => {
                            //计算hash
                            const packHash: string = await Util.getSHA256(file, true);
                            logger.writeDebug(`Success download icon pack.Hash:${packHash}`);
                            //解压
                            const zipFile = new nodeStreamZip.async({ file: file });
                            //创建目录
                            //删除旧目录重新创建
                            await fs.remove(extractDir);
                            await fs.ensureDir(extractDir);
                            await zipFile.extract(null, extractDir);
                            await zipFile.close();
                            //保存hash 放在解压成功之后
                            //先删掉旧的
                            await fs.remove(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`);
                            await fs.writeFile(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`, packHash);
                            //删除缓存
                            await fs.remove(file);
                            logger.writeInfo("Success download and extracted applications icon pack");
                            //移除提醒
                            this.appWindow.webContents.send("webviewEvent", "remove_state", "busy_waiting_icon_pack");
                        }
                    })
                    logger.writeDebug("File init success");
                } catch (error: any) {
                    logger.writeError(`Init file socket failed:${error}`);
                    socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR" }));
                    return
                }
                socket.send(JSON.stringify({ _responseId: jsonObj._requestId, port: fileSocket.port, _result: "SUCCESS" }));
                break
            case "trustModeChange":
                //设备信任模式切换
                logger.writeInfo(`Trust mode changed to:${jsonObj.trusted ? "trusted" : "untrusted"}`);
                this.appWindow.webContents.send("webviewEvent", "trustModeChange", jsonObj.trusted)
                break
            case "updateDeviceState":
                //更新设备状态 电量 温度显示等
                this.appWindow.webContents.send("webviewEvent", "updateDeviceState", jsonObj);
                break
            case "edit_state":
                this.appWindow.webContents.send("webviewEvent", jsonObj.type==="add"?"add_state":"remove_state", jsonObj.name);
                break   
            case undefined:
            case null:
                //无packetType属性
                logger.writeWarn("Missing packet type");
                break
            default:
                //检查协议版本
                logger.writeWarn(`Invalid packet type:${jsonObj.packetType}`);
                console.log(jsonObj);
            //握手完成后pc发送一个包含时间戳的包检查延迟并带有消息 安卓端也返回时间戳和一段消息 就此完成连接 打开主界面
        }
        /* 要在clients里挨个调用close手机端才能不报错 */
        /* 连接成功由手机端发送首次握手消息 包含协议版本 安卓版本等 超过8秒无响应主动断开连接
        握手成功则转入主界面 */

    }
    /**
     *@private
     *@description 断开连接时回调
     * @param {number} code
     * @param {Buffer} reason
     * @memberof server
     */
    onSocketClose(code: number, reason: Buffer) {
        //TODO updateDeviceState包加上时间戳
        if (this.isClosed) return
        this.isClosed = true;
        const reasonString = reason.toString("utf-8");
        if (!this.appWindow.isDestroyed()) this.appWindow.flashFrame(true);
        //如果关闭了默认弹窗则不往下执行
        if (!this.showDefaultDisconnectAlert) return
        logger.writeInfo(`Server socket closed`);
        //检查窗口是否显示 不可显示则发送通知
        if (!this.appWindow.isDestroyed() && !this.appWindow.isVisible()) {
            logger.writeInfo(`Post device disconnect notification`);
            //直接用Electron自带通知
            const notification = new Notification({
                title: "设备断开连接",
                body: `${global.clientMetadata.model}已断开连接`,
            });
            //关闭除主窗口和调试窗口外所有窗口
            BrowserWindow.getAllWindows().forEach(window => {
                if (!window.title.startsWith("Suisho Connector:") && window.title !== "DebugPanel") {
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
            notification.on("click", event => {
                if (this.appWindow !== null && !this.appWindow.isDestroyed()) {
                    this.appWindow.show();
                    if (this.appWindow.isMinimized()) {
                        this.appWindow.restore();
                    }
                    this.appWindow.focus();
                }
                notification.close();
            })
            notification.show();
        }

        //关闭窗口时会触发 但窗口已经关闭了 所以会报错
        //判断窗口
        if (this.isInMainWindow) {
            const reasonStr=ConnectionCloseReasonString[code as ConnectionCloseCode]??"由于未知异常 连接断开";
            if (!this.appWindow.isDestroyed()) this.appWindow.webContents.send("webviewEvent", "disconnect", reasonStr);
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
     * @param {ws} socket
     * @memberof server
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
            beatTimer = setTimeout(() => {
                logger.writeInfo("Android client dead");
                //关闭连接
                this.close();
                //移除监听
                socket.removeListener("pong", onPong);
                //手动触发回调
                this.onSocketClose(ConnectionCloseCode.CloseHeartBeatTimeout, Buffer.allocUnsafe(1));
            }, 5 * 1000);
            //发起ping
            pingTime = Date.now();
            socket.ping();
        }
        //设置回调
        socket.on("pong", onPong);
        //发起首次ping
        logger.writeDebug("first heartbeat polling start");
        socket.ping();
    }
    /**
     * @param {String} fileName 文件名
     * @param {String} writeDir 文件路径
     * @param {number} fileSize 文件大小
     * @param {BrowserWindow} webContent 浏览器窗口 发信号用
     * @param {String} displayName
     * @memberof server
     * @returns {TransmitFileWriter | ReferenceError}
     */
    createTransmitFileSocket(fileName: string, writeDir: string, fileSize: number, webContent: BrowserWindow, displayName: string, encryptionKeyBase64: string, encryptIvBase64: string): TransmitFileWriter | ReferenceError {
        //有端口检测了 虽然比较奇葩
        try {
            return new TransmitFileWriter(randomThing.number(1, 65535), fileName, writeDir, fileSize, webContent, displayName, encryptionKeyBase64, encryptIvBase64);
        } catch (error: any) {
            if (error.code === "EADDRINUSE") {
                //端口号重复 重新调用
                return this.createTransmitFileSocket(fileName, writeDir, fileSize, webContent, displayName, encryptionKeyBase64, encryptIvBase64);
            } else {
                //上面处理了 不用日志
                //其他异常
                return new ReferenceError(error.stack);
            }
        }
    }
    createFileSocket(target: string, filePath: string, size?: number, hash?: string): SocketFileWriter | ReferenceError {
        try {
            return new SocketFileWriter(randomThing.number(1, 65535), target, filePath, size || null);
        } catch (error: any) {
            if (error.code === "EADDRINUSE") {
                //端口号重复 重新调用
                return this.createFileSocket(target, filePath, size || undefined);
            } else {
                //上面处理了 不用日志
                //其他异常
                return new ReferenceError(error.stack);
            }
        }
    };

    /**
     * @description 设置BrowserWindow对象
     * @param {BrowserWindow} bw
     * @memberof server
     */
    setWindow(bw: BrowserWindow) {
        this.appWindow = bw;
        this.notificationCore?.setWindow(bw);
        logger.writeDebug("Server set main window instance");
    }
    getNotificationManager() {
        return this.notificationCore;
    }
    /**
     * @description 跨进程消息处理
     * @typedef {ws.WebSocket} sc
     * @param {ws} socket
     * @memberof server
     */
    async initWebviewHandles(socket: ws) {
        ipcMain.handle("main_getDeviceDetailInfo", async (event) => {
            try {
                return await this.responseManager?.send({ packetType: "main_getDeviceDetailInfo" });
            } catch (error) {
                // console.log(error);
                logger.writeError(`Failed init webview handle:${error}`)
                return new Promise((resolve, reject) => {
                    reject(error);
                })
            }
        });
        //发包 无响应
        ipcMain.handle("main_sendPacket", (event, data: string | Object) => {
            //允许直接发送对象
            logger.writeDebug("Renderer send a packet");
            if (data instanceof Object) {
                socket.send(JSON.stringify(data));
                return
            }
            socket.send(data)
        });
        ipcMain.handle("main_sendRequestPacket", async (event, data: Object): Promise<any> => {
            logger.writeDebug("Renderer send a request packet");
            if (data instanceof Object) {
                return await this.responseManager?.send(data as any);
            }
            //非对象不可发送
            logger.writeError(`Request packet data must an Object,but data type is ${typeof data}`);
            return null;
        });

        //互传pc上传文件
        ipcMain.handle("transmit_uploadFile", async (event, name, path, size, form) => {
            try {
                let uploader: TransmitFileUploader | null = new TransmitFileUploader(path, name, {
                    //发生问题 取消请求并释放资源
                    onCancel: () => {
                        this.responseManager?.cancel(RequestId.REQUEST_TRANSMIT_COMPUTER_UPLOAD_FILE);
                        uploader = null;
                    },
                    onProgress: (value: number) => {
                        // logger.writeDebug(`Upload file progress update:${value}`);
                        this.appWindow.webContents.send("fileUploadProgressUpdate", value);
                    },
                    //完成 只需要释放资源
                    onSuccess: () => {
                        uploader = null;
                        logger.writeInfo("Upload file success");
                        this.appWindow.webContents.send("webviewEvent", "transmit_fileUploadSuccess", name, name, 1, form === undefined ? 0 : form);
                    },
                    //失败时执行 throw可能抓不到
                    onError: (error: { message: any; }) => this.appWindow.webContents.send("webviewEvent", "transmit_fileTransmitFailed", "上传失败", error.message)
                });
                await uploader.init();
                this.responseManager?.send({ packetType: "transmit_uploadFile", port: <number>uploader.port, fileName: name, _request_id: RequestId.REQUEST_TRANSMIT_COMPUTER_UPLOAD_FILE, fileSize: size });
            } catch (error: any) {
                logger.writeError(`Upload file failed:${error}`);
                this.appWindow.webContents.send("webviewEvent", "transmit_fileTransmitFailed", "上传失败", error.message);
            }
        });
        ipcMain.handle("file_listDir", async (event, dirPath) => {
            return await this.responseManager?.send({ packetType: "file_getFilesList", msg: dirPath });
        });
        ipcMain.handle("notificationForward_getPackageList",async (event,forceRefresh:boolean=false)=>{
            if (!forceRefresh&&this.appListCache) {
                logger.writeDebug("Load package list from cache")
                return this.appListCache;
            }
            await this.createAppListCache();
            if (forceRefresh) {
                logger.writeDebug("Force refresh package list")
                this.notificationCore?.configWindow?.close();
                setTimeout(() => {
                    this.notificationCore?.openConfigWindow();
                }, 250);
            }
            return this.appListCache;
        })
    }
    async checkAndroidClientPermission(permission: string) {
        return await this.responseManager?.send({ packetType: "main_checkPermission", name: permission });
    }
    get clients() {
        return this.websocket?.clients
    }
    getPhoneAddress(): string {
        return this.phoneAddress as string;
    }
}
export default Server;