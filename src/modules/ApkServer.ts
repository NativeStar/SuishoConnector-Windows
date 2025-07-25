import http from "http";
import fs from "fs-extra";
class ApkServer{
    private initd:boolean=false;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    indexHtml:string;
    private packageSize:number;
    constructor(){
        if (fs.existsSync("./assets/html/apkDownload.html")) {
            this.indexHtml=fs.readFileSync("./assets/html/apkDownload.html",{encoding:"utf-8"});
        }else{
            this.indexHtml=`
                <html>
                    <body>
                        <span>发生异常:文件丢失 请重新安装软件以修复</span>
                    </body>
                </html>
            `
        };
        this.packageSize=fs.statSync("./res/android/package.apk").size;
        this.server=http.createServer((req,res)=>{
            if (req.url==="/dlPackage") {
                if (!fs.existsSync("./res/android/package.apk")) {
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
                    return
                }
                res.writeHead(200,{"Content-Type":"application/vnd.android.package-archive","Content-Length":this.packageSize,"Content-Disposition": 'attachment; filename="SuishoConnectorAndroid.apk"'});
                fs.createReadStream("./res/android/package.apk").pipe(res);
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
                res.destroy();
            }
        });
    }
    start(){
        if(this.initd) return;
        this.server.listen(25120);
        this.initd=true;
        logger.writeInfo("Apk download server started");
    }
    close(){
        this.server.close();
        logger.writeDebug("Apk download server closed");
    }
}
export default ApkServer;