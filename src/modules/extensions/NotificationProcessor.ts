import RT from "randomthing-js";
import ws from "ws";
import isPortAvailable from "is-port-available";
type ClientMessageObject = {
    type: "verify" | "setting" | "cancelNotification",
    config: "targetPackageName"
    target?: string[];
    token?: string;
    id?: number;
}
type ConnectionState = "close" | "idle" | "connected"|"shutdown";
type NotificationProcessorEventHandler = {
    onPortInUse: () => void;
    onConnectStateChange: (state: ConnectionState) => void;
    requestCancelNotification: (id: number) => void;
    onSetTargetPackageName: (packageName: string[]) => void;
}
type NotificationData = {
    type?: string,
    packageName: string,
    appName: string,
    timestamp: number,
    title: string,
    content: string,
    id: number
}
class NotificationProcessor {
    private verified: boolean = false;
    private server: ws.Server|null=null;
    private socket: ws | null = null;
    private token: string | null = null;
    private state: ConnectionState = "close";
    private handler: NotificationProcessorEventHandler;
    private port: number;
    private LOG_TAG:string="NotificationProcessor"
    constructor(port: number, eventHandler: NotificationProcessorEventHandler) {
        this.handler = eventHandler;
        this.port = port;
    }
    async init(): Promise<string | null> {
        //检测端口可用
        if (await !isPortAvailable(this.port)) {
            logger.writeInfo(`Port ${this.port} is in use`,this.LOG_TAG);
            this.handler.onPortInUse();
            return null;
        }
        this.server = new ws.Server({ port: this.port });
        logger.writeInfo(`Listening port:${this.port}`,this.LOG_TAG);
        this.server.on("connection", (newSocket) => {
            //只允许一个连接
            if (this.state !== "idle") {
                logger.writeInfo(`Too many connection`,this.LOG_TAG);
                newSocket.close(1000);
                return
            }
            this.socket = newSocket;
            newSocket.on("message", (data) => this.onSocketMessage(data.toString()));
            newSocket.on("close", () => this.onSocketClose());
            this.state = "connected";
            logger.writeInfo("Extension connected",this.LOG_TAG)
            this.handler.onConnectStateChange(this.state);
        });
        //生成token
        if (this.token === null) {
            this.token = RT.number_en(256);
        }
        this.state = "idle"
        this.handler.onConnectStateChange(this.state);
        return this.token;
    }
    private onSocketClose(): void {
        logger.writeInfo("Connection closed",this.LOG_TAG);
        this.state = "idle"
        this.verified = false;
        this.handler.onConnectStateChange(this.state);
    }
    private onSocketMessage(data: string): void {
        let dataObj: ClientMessageObject;
        try {
            dataObj = JSON.parse(data) as ClientMessageObject;
        } catch (error) {
            //解析失败
            this.socket?.close(1003);
            return
        }
        //验证
        if (!this.verified) {
            if (dataObj.type === "verify" && dataObj.token === this.token) {
                //验证通过
                logger.writeInfo("Extension verify success",this.LOG_TAG);
                this.verified = true;
                this.socket?.send(JSON.stringify({ type: "verify_success" }));
            } else {
                logger.writeInfo("Extension verify failed",this.LOG_TAG);
                logger.writeDebug(`Got bad token:${dataObj.token} with packet type:${dataObj.type}`,this.LOG_TAG);
                this.socket?.close(1008);
            }
            return
        }
        switch (dataObj.type) {
            case "cancelNotification":
                if (dataObj.id) {
                    this.handler.requestCancelNotification(dataObj.id);
                }
                logger.writeDebug(`Canceled notification id ${dataObj.id}`,this.LOG_TAG)
                break;
            case "setting":
                if (dataObj.config === "targetPackageName" && dataObj.target) {
                    logger.writeInfo(`Set target package name`,this.LOG_TAG);
                    logger.writeDebug(`Target package name:${dataObj.target}`,this.LOG_TAG);
                    this.handler.onSetTargetPackageName(dataObj.target);
                }
                break
            default:
                logger.writeWarn(`Invalid extension message type:${dataObj.type}`,this.LOG_TAG);
                break;
        }
    }
    send(data: NotificationData): void {
        data.type = "notification";
        this.socket?.send(JSON.stringify(data));
    }
    close(){
        this.socket?.close();
        this.server?.close();
        this.state="shutdown";
        this.verified=false;
        this.token=null;
        this.handler.onConnectStateChange(this.state);
    }
}
export default NotificationProcessor;