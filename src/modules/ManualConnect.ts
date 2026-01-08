import { createServer, Server } from "https";
import fs from "fs-extra";
import randomThing from "randomthing-js"
import { app } from "electron";
import path from "path";
class ManualConnect {
    serverPort: number;
    certPort: number;
    id: string;
    server: Server | null
    //转成字符串的连接信息对象
    successResponseObjectString: string;
    failedResponseObjectString: string;
    pairCode: string;
    pairToken: string;
    ipConnectCounter: Map<string, number>
    private static readonly LOG_TAG: string = "ManualConnect";
    constructor(serverPort: number, certPort: number, id: string, pairToken: string) {
        this.serverPort = serverPort;
        this.certPort = certPort;
        this.id = id;
        this.server = null;
        this.pairCode = randomThing.number(100000, 999999).toString();
        this.pairToken = pairToken;
        this.ipConnectCounter = new Map();
        this.successResponseObjectString = JSON.stringify({
            success: true,
            mainPort: this.serverPort,
            certPort: this.certPort,
            id: this.id,
            token: this.pairToken
        });
        this.failedResponseObjectString = JSON.stringify({
            success: false,
            message: "验证失败 如为手动连接请检查配对码是否正确 或改为使用扫码连接"
        });
    }
    async init() {
        this.server = createServer({
            key: fs.readFileSync(path.join(app.getAppPath(), "res", "cert", "default.key")),
            cert: fs.readFileSync(path.join(app.getAppPath(), "res", "cert", "default.crt"))
        }, async (req, res) => {
            const ip = req.socket.remoteAddress ?? null;
            if (req.headers["user-agent"] === "Shamiko") {
                if (ip && this.ipConnectCounter.has(ip) && this.ipConnectCounter.get(ip)! > 5) {
                    res.writeHead(429);
                    res.end(JSON.stringify({
                        success: false,
                        message: "该地址验证失败过多 请重启PC端后重试或使用扫码连接"
                    }));
                    logger.writeDebug(`IP ${ip} blocked by too many verify failed`, ManualConnect.LOG_TAG)
                    return
                }
                const pairCode = req.headers["suisho-pair-code"];
                const autoConnectorKey = req.headers["suisho-auto-connector-key"];
                if (pairCode) {
                    if (pairCode === this.pairCode) {
                        res.writeHead(200);
                        res.end(this.successResponseObjectString);
                        logger.writeInfo(`IP ${ip} connect verify success`, ManualConnect.LOG_TAG)
                        return
                    }
                    if (ip) {
                        this.ipConnectCounter.has(ip) ? this.ipConnectCounter.set(ip, this.ipConnectCounter.get(ip)! + 1) : this.ipConnectCounter.set(ip, 1);
                    }
                    logger.writeInfo(`IP ${ip} connect verify failed`, ManualConnect.LOG_TAG)
                    res.writeHead(200);
                    res.end(this.failedResponseObjectString);
                    return
                }
                if (autoConnectorKey) {
                    if (autoConnectorKey === global.config.boundDeviceKey) {
                        res.writeHead(200);
                        res.end(this.successResponseObjectString);
                        logger.writeInfo(`IP ${ip} connect verify success`, ManualConnect.LOG_TAG)
                        return
                    }
                    if (ip) {
                        this.ipConnectCounter.has(ip) ? this.ipConnectCounter.set(ip, this.ipConnectCounter.get(ip)! + 1) : this.ipConnectCounter.set(ip, 1);
                    }
                    logger.writeInfo(`IP ${ip} connect verify failed`, ManualConnect.LOG_TAG)
                    res.writeHead(200);
                    res.end(this.failedResponseObjectString);
                    return
                }
            }
            res.destroy()
        });
        this.server.listen(39865)
    }
    close() {
        logger.writeDebug("Manual connect server closed")
        this.server?.close();
    }
}
export default ManualConnect;
