import fs from "fs-extra";
import http from "http";
import path from "path";
import { BrowserWindow, ipcMain ,app} from "electron";
class OAuthService {
    private server:http.Server|null;
    port:number;
    private oauthKeyBinary:ArrayBuffer|Buffer|null;
    private keyPath:string=`${app.getPath("userData")}/programData/oauth.bin`;
    private authWindow:BrowserWindow|null;
    //创建凭证handle是否初始化完成
    private initdCreateCredentialsHandle:boolean=false;
    private initdAuthorizationHandle:boolean=false;
    //离谱修复方法 不这么做回调时永远调用第一个promise 即使它已经resolve
    private tempPromise:{resolve:Function,reject:Function};
    constructor(port:number|null=null) {
        this.tempPromise={resolve:()=>{},reject:()=>{}};
        this.authWindow=null;
        this.server=null;
        this.port=port??32767;
        fs.existsSync(this.keyPath)?this.oauthKeyBinary=fs.readFileSync(this.keyPath):this.oauthKeyBinary=null;
    }
    async init():Promise<void> {
        // 直接加载文件没法调用auth 至少要localhost
        this.server=http.createServer(async (req,res)=>{
            if (req.url==="/localAuth"&&req.headers["user-agent"]==="suisho_local_auth_request_window") {
                res.writeHead(200).end(await fs.readFile("./res/oauth.html","utf-8"));
                return
            }
            res.destroy();
        });
        //保存原始密钥文件
        ipcMain.handle("oauth_saveRawID",async (event,buffer:ArrayBuffer)=>{
            this.oauthKeyBinary=buffer;
            await fs.writeFile(`${app.getPath("userData")}/programData/oauth.bin`,new DataView(buffer));
            logger.writeInfo("Saved oauth key binary");
        })
        this.server.listen(this.port);
    }
    /**
     * 创建凭证
     * @returns 创建是否成功
     */
    createCredentials():Promise<boolean>{
        if (this.tempPromise.resolve!=null) {
            this.tempPromise.resolve(false);
        }
        return new Promise<boolean>((resolve, reject) => {
            this.tempPromise.resolve=resolve;
            this.tempPromise.reject=reject;
            if (this.authWindow!==null) {
                this.authWindow.close();
                this.authWindow=null;
            }
            //不显示的验证窗口
            this.authWindow=new BrowserWindow({
                show:false,
                focusable:false,
                frame:false,
                title:"Local Auth",
                webPreferences:{
                    devTools:false,
                    preload:path.join(__dirname,"../preload/oauthPreload.js")
                }
            });
            this.authWindow.addListener("ready-to-show",()=>{
                this.authWindow?.webContents.send("createCredentials");
                logger.writeDebug("Opened oauth window")
            });
            this.authWindow.setMenu(null);
            this.authWindow.webContents.setUserAgent("suisho_local_auth_request_window");
            this.authWindow.loadURL(`http://localhost:${this.port}/localAuth`);
            this.authWindow.addListener("close",()=>{
                this.authWindow?.destroy();
                this.authWindow=null;
                logger.writeDebug("Closed oauth window");
            });
            //要调用resolve 只能在这了
            if (!this.initdCreateCredentialsHandle) {
                ipcMain.on("oauth_createCredentialsCallback",(event,result:boolean)=>{
                    this.authWindow?.close();
                    this.tempPromise.resolve(result);
                    logger.writeDebug(`Create key result:${result}`);
                });
                this.initdCreateCredentialsHandle=true;
            }
        })
    }
    startAuthorization(){
        if (this.tempPromise.resolve!=null) {
            this.tempPromise.resolve(false);
        }
        return new Promise<boolean>((resolve, reject) => {
            this.tempPromise.resolve=resolve;
            this.tempPromise.reject=reject;
            //检查key是否存在
            if (this.oauthKeyBinary===null) {
                logger.writeWarn("Request authentication but none key");
                this.tempPromise.resolve(false);
                return
            }
            //窗口
            if (this.authWindow!==null) {
                this.authWindow.close();
                this.authWindow=null;
            }
            //不显示的验证窗口
            this.authWindow=new BrowserWindow({
                show:false,
                focusable:false,
                frame:false,
                title:"Local Auth",
                webPreferences:{
                    devTools:false,
                    preload:path.join(__dirname,"../preload/oauthPreload.js")
                }
            });
            this.authWindow.addListener("ready-to-show",()=>{
                this.authWindow?.webContents.send("startAuthorization",this.oauthKeyBinary);
                logger.writeDebug("Opened oauth window")
            });
            this.authWindow.setMenu(null);
            this.authWindow.webContents.setUserAgent("suisho_local_auth_request_window");
            this.authWindow.loadURL(`http://localhost:${this.port}/localAuth`);
            this.authWindow.addListener("close",()=>{
                this.authWindow?.destroy();
                this.authWindow=null;
                logger.writeDebug("Closed oauth window");
            });
            //要调用resolve 只能在这了
            if (!this.initdAuthorizationHandle) {
                ipcMain.on("oauth_authorizationCallback",(event,result:boolean)=>{
                    this.authWindow?.close();
                    this.tempPromise.resolve(result);
                    logger.writeDebug(`Authentication result:${result}`);
                    return
                });
                this.initdAuthorizationHandle=true;
            }
        })
    }
}
export default OAuthService;