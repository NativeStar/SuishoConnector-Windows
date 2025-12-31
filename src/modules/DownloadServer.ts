import { createServer, Server } from "https";
import fs from "fs-extra";
import { AddressInfo } from "net";
class DownloadServer {
    private port: number | null;
    private fileStream: fs.ReadStream | null;
    private server: Server | null
    private filePath: string;
    private label?: string;
    private fileData: Buffer | null;
    private fileSize: number;
    constructor(file: string, port: number | null, label?: string) {
        this.port = port;
        this.filePath = file;
        this.server = null;
        this.fileStream = null;
        this.fileData = null;
        this.fileSize = fs.statSync(file).size;
        if (label) this.label = label;
    }
    async init() {
        if (!fs.existsSync(this.filePath)) {
            throw new ReferenceError("File not found:" + this.filePath);
        };
        //小文件直接整个加载 避免某些问题
        if (this.fileSize <= 10240) {
            logger.writeInfo(`Download server:${this.label || "Not label"} working with blob mode:${this.filePath}`)
            this.fileData = fs.readFileSync(this.filePath);
        } else {
            logger.writeInfo(`Download server:${this.label || "Not label"} working with stream mode:${this.filePath}`);
            this.fileStream = fs.createReadStream(this.filePath);
        }
        this.server = createServer({
            key: fs.readFileSync("./res/cert/default.key"),
            cert: fs.readFileSync("./res/cert/default.crt")
        }, (req, res) => {
            //对上ua才发送
            if (req.headers["user-agent"] === "I HATE YOU") {
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Content-Length", this.fileSize);
                res.writeHead(200);
                if (this.fileData !== null) {
                    res.end(this.fileData);
                } else {
                    this.fileStream?.pipe(res);
                }
                logger.writeInfo(`Download server sent file:${this.filePath}`);
                return
            }
            logger.writeInfo(`Download server received request from ${req.headers["user-agent"]}`);
            res.destroy();
        });
        this.server.listen(this.port ?? 0);
        if (this.label) {
            logger.writeInfo(`Download server:${this.label} launched`);
            return
        };
        logger.writeInfo("Download server launched");
    }
    close() {
        this.server?.close();
        this.fileStream?.close();
        if (this.label) {
            logger.writeInfo(`Download server:${this.label} closed`);
            return
        };
        logger.writeInfo("Download server closed");
    }
    get serverPost(): number {
        return <number>this.port?? (this.server?.address() as AddressInfo).port;
    }
}
export default DownloadServer;