import http from "http";
import fs from "fs-extra";
import path from "path";
import { app } from "electron";
class ApkServer{
    private initd:boolean=false;
    private readonly htmlPath:string;
    private readonly packagePath: string;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    indexHtml:string;
    private packageSize:number;
    private readonly LOG_TAG="ApkServer";
    constructor(){
        this.htmlPath=path.join(app.getAppPath(),"res","android","apkDownload.html");
        this.packagePath=path.join(app.getAppPath(),"res","android","package.apk");
        if (fs.existsSync(this.htmlPath)) {
            this.indexHtml=fs.readFileSync(this.htmlPath,{encoding:"utf-8"});
        }else{
            logger.writeWarn("HTML file not found",this.LOG_TAG);
            this.indexHtml=`
                <html>
                    <body>
                        <span>发生异常:文件丢失 请重新安装PC端以修复</span>
                    </body>
                </html>
            `
        };
        this.packageSize=fs.statSync(this.packagePath).size;
        this.server=http.createServer((req,res)=>{
            if (req.url==="/dlPackage") {
                if (!fs.existsSync(this.packagePath)) {
                    res.writeHead(404, {
                        'content-type': 'text/html;charset=utf8'
                    });
                    res.end(`
                    <html>
                        <body>
                            <span>发生异常:本地安装包文件丢失 请前往官方仓库下载或重新安装PC端以修复</span>
                        </body>
                    </html>    
                    `);
                    logger.writeWarn("Package file not found",this.LOG_TAG);
                    return
                }
                res.writeHead(200,{"Content-Type":"application/vnd.android.package-archive","Content-Length":this.packageSize,"Content-Disposition": 'attachment; filename="SuishoConnectorAndroid.apk"'});
                fs.createReadStream(this.packagePath).pipe(res);
                logger.writeInfo(`Download request received from ${req.socket.address()}`,this.LOG_TAG);
                /* 
                用于给客户端判定
                避免某些人想更新软件什么的结果拿装好的客户端扫这个码或者纯粹没分清
                安卓端检测到该内容弹出提示
                */
            }else if(req.url==="/suishoPkgDownload"){
                res.writeHead(200, {
                    'content-type': 'text/html;charset=utf8'
                }).end(this.indexHtml);
            }else{
                //拒绝连接
                logger.writeDebug(`Invalid request received from ${req.socket.remoteAddress}`,this.LOG_TAG);
                res.destroy();
            }
        });
    }
    start(){
        if(this.initd) return;
        this.server.listen(25120);
        this.initd=true;
        logger.writeInfo("Apk download server started",this.LOG_TAG);
    }
    close(){
        this.server.close();
        logger.writeDebug("Apk download server closed",this.LOG_TAG);
    }
}
export default ApkServer;