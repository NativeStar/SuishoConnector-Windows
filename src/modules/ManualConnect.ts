import { createServer, Server } from "http";
import randomThing from "randomthing-js"
type Response = {
    mainPort: number,
    certPort: number,
    id: string
}
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
    constructor(serverPort: number, certPort: number, id: string, pairToken: string) {
        this.serverPort = serverPort;
        this.certPort = certPort;
        this.id = id;
        this.server = null;
        this.pairCode = randomThing.number(100000, 999999).toString();
        this.pairToken = pairToken;
        this.successResponseObjectString = JSON.stringify({
            success: true,
            mainPort: this.serverPort,
            certPort: this.certPort,
            id: this.id,
            token: this.pairToken
        });
        this.failedResponseObjectString = JSON.stringify({
            success: false,
            message: "验证失败 请检查配对码是否正确或使用扫码连接"
        });
    }
    async init() {
        this.server = createServer(async (req, res) => {
            if (req.headers["user-agent"] === "Shamiko") {
                const pairCode = req.headers["suisho-pair-code"];
                const autoConnectorKey = req.headers["suisho-auto-connector-key"];
                if (pairCode) {
                    if (pairCode === this.pairCode) {
                        res.writeHead(200);
                        res.end(this.successResponseObjectString);
                        return
                    }
                    // TODO 失败计数暂时拉黑
                    res.writeHead(200);
                    res.end(this.failedResponseObjectString);
                    return
                }
                if (autoConnectorKey) {
                    if (autoConnectorKey === global.config.boundDeviceKey) {
                        res.writeHead(200);
                        res.end(this.successResponseObjectString);
                        return
                    }
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