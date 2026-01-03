import { createSocket, Socket } from "dgram";
import { app, dialog,BrowserWindow } from "electron";
import { exec } from "child_process";
import Util from "./Util";
class Broadcaster {
    private socket: Socket;
    private looper: number | null | NodeJS.Timeout;
    private deviceId: string;
    constructor(deviceId:string) {
        this.looper = null;
        this.deviceId = deviceId;
        this.socket = createSocket("udp4");
        this.socket.on("error", async (err) => {
            logger.writeWarn(`Broadcaster socket open error:${err}`);
            BrowserWindow.getAllWindows().forEach(window=>{
                window.webContents.send("main_autoConnectError");
            });
            const processInfo = await Util.getUsingPortProcessNameAndPid(60127);
            if (processInfo) {
                const dialogResult = await dialog.showMessageBox({
                    type: "warning",
                    message: `自动连接未能按预期工作 因为所需的端口被进程"${processInfo.name}"占用\n终止该进程或重启计算机可能解决该问题\n或者通过手动扫码连接\n如选择终止进程 会在尝试杀进程后自动重启本软件\n且必要时会申请管理员权限`,
                    buttons: ["终止进程", "忽略"],
                    defaultId: 0,
                    title: "自动连接异常"
                });
                //选择了杀进程
                if (dialogResult.response === 0) {
                    logger.writeInfo(`Trying kill process ${processInfo.name}:${processInfo.pid}`);
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
                    logger.writeInfo("Reboot application");
                    app.relaunch();
                    app.quit();
                }
                return
            }
            logger.writeError(err);
            dialog.showErrorBox("自动连接异常", `功能发生未知异常 重启计算机可能解决该问题\n或者尝试手动扫码连接\n详情:${err}`);
        });
    }
    start() {
        //10秒一次循环
        logger.writeInfo("Start network broadcast");
        this.socket.bind(60127, () => {
            this.socket.setBroadcast(true);
            const msgBuffer = Uint8Array.from(Buffer.from(this.deviceId));
            //不知道为什么 Windows上如果是系统启动后首次发的包会被吞
            setTimeout(() => {
                try {
                    //如果打开立即扫码连接早于2.5s 这里会崩溃
                    this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, `255.255.255.255`);
                } catch (error) {};
            }, 2500);
            this.looper = setInterval(() => {
                try {
                    this.socket.send(msgBuffer, 0, msgBuffer.length, 60127, `255.255.255.255`);
                } catch (error) { };
                logger.writeDebug("Sent a broadcast packet");
            }, 5 * 1000)
        })
    }
    close() {
        if (this.looper !== null) clearInterval(this.looper);
        this.socket.close();
        logger.writeInfo("Stop network broadcast");
    }
}
export default Broadcaster