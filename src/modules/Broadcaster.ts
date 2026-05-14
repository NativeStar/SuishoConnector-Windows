import { createSocket,type Socket } from "dgram";
import { type WebContents } from "electron";
import Util from "./Util";
class Broadcaster {
    private socket: Socket;
    private sender: WebContents;
    private broadcastLooper: number | null | NodeJS.Timeout;
    private unicastLooper: number | null | NodeJS.Timeout;
    private deviceId: string;
    private readonly LOG_TAG = "Broadcaster";
    constructor(deviceId: string, sender: WebContents) {
        this.broadcastLooper = null;
        this.unicastLooper = null;
        this.deviceId = deviceId;
        this.sender = sender;
        this.socket = createSocket("udp4");
        this.socket.on("error", async (err) => {
            logger.writeWarn(`Socket open error:${err}`, this.LOG_TAG);
            this.sender.send("main_autoConnectError");
            const processInfo = await Util.getUsingPortProcessNameAndPid(60127);
            const {dialog,app}=await import("electron");
            const {exec}=await import("child_process");
            if (processInfo) {
                logger.writeWarn(`Process ${processInfo.name} is using port 60127`, this.LOG_TAG);
                const dialogResult = await dialog.showMessageBox({
                    type: "warning",
                    message: `自动连接未能按预期工作 因为所需的端口被进程"${processInfo.name}"占用\n终止该进程或重启计算机可能解决该问题\n或者通过手动扫码连接\n如选择终止进程 会在尝试杀进程后自动重启本软件\n且必要时会申请管理员权限`,
                    buttons: ["终止进程", "忽略"],
                    defaultId: 0,
                    title: "自动连接异常"
                });
                //选择了杀进程
                if (dialogResult.response === 0) {
                    logger.writeInfo(`Trying kill process ${processInfo.name}:${processInfo.pid}`, this.LOG_TAG);
                    try {
                        process.kill(processInfo.pid);
                    } catch (error) {
                        //权限不足 提权
                        if ((error as Error).message === "kill EPERM") {
                            exec(`powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c taskkill /F /PID ${processInfo.pid} && command -argument'"`).addListener("exit", () => {
                                logger.writeInfo("Reboot application");
                                app.relaunch();
                                app.quit();
                            })
                        }
                        return
                    }
                    logger.writeInfo("Reboot application", this.LOG_TAG);
                    app.relaunch();
                    app.quit();
                }
                return
            }
            logger.writeError(err, this.LOG_TAG);
            dialog.showErrorBox("自动连接异常", `功能发生未知异常 重启计算机可能解决该问题\n或者尝试手动扫码连接\n详情:${err}`);
        });
    }
    start() {
        //10秒一次循环
        logger.writeInfo("Start network broadcast", this.LOG_TAG);
        this.socket.bind(60127, () => {
            this.socket.setBroadcast(true);
            const msgBuffer = Uint8Array.from(Buffer.from(this.deviceId));
            //不知道为什么 启动后首次发的包会被吞
            //先快速发两个包 缩短启动后触发连接耗时
            setTimeout(() => {
                try {
                    //如果已经完成连接 这里会崩溃
                    this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, `255.255.255.255`);
                    if (!this.sender.isDestroyed()) this.sender.send("connectPhone_broadcastSent")
                } catch (error) { };
            }, 1000);
            setTimeout(() => {
                try {
                    if (global.config.additionalUnicast && global.config["internal:boundDeviceAddress"] && global.config["internal:boundDeviceAddress"] !== "") {
                        this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, global.config["internal:boundDeviceAddress"]);
                    } else {
                        this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, `255.255.255.255`);
                    }
                    if (!this.sender.isDestroyed()) this.sender.send("connectPhone_broadcastSent")
                } catch { };
            }, 3000);
            this.broadcastLooper = setInterval(() => {
                try {
                    this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, `255.255.255.255`);
                    if (!this.sender.isDestroyed()) this.sender.send("connectPhone_broadcastSent")
                } catch { };
                logger.writeDebug("Sent a broadcast packet");
            }, 5000);
            //根据情况决定是否单播
            if (global.config.additionalUnicast && global.config["internal:boundDeviceAddress"] && global.config["internal:boundDeviceAddress"] !== "") {
                setTimeout(() => {
                    this.unicastLooper = setInterval(() => {
                        try {
                            this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, global.config["internal:boundDeviceAddress"]);
                            if (!this.sender.isDestroyed()) this.sender.send("connectPhone_broadcastSent")
                        } catch { }
                        logger.writeDebug("Sent a unicast packet");
                    }, 5000);
                }, 2500);
            }
        })
    }
    close() {
        if (this.broadcastLooper !== null) clearInterval(this.broadcastLooper);
        if (this.unicastLooper !== null) clearInterval(this.unicastLooper);
        this.socket.close();
        logger.writeInfo("Stop network broadcast", this.LOG_TAG);
    }
}
export default Broadcaster