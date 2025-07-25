import { createServer,Server } from "http";
type response={
    mainPort:number,
    certPort:number,
    id:string
}
class ManualConnect{
    serverPort: number;
    certPort: number;
    id: string;
    server:Server|null
    //转成字符串的连接信息对象
    responseObject:string;
    constructor(serverPort:number,certPort:number,id:string){
        this.serverPort=serverPort;
        this.certPort=certPort;
        this.id=id;
        this.server=null;
        this.responseObject=JSON.stringify({
            mainPort:this.serverPort,
            certPort:this.certPort,
            id:this.id
        })
    }
    async init(){
        this.server=createServer(async (req,res)=>{
            if(req.headers["user-agent"]==="Shamiko"){
                // res.setHeader("Content-Type","application/octet-stream");
                res.setHeader("Content-Length",this.responseObject.length);
                res.writeHead(200);
                res.end(this.responseObject);
                return
            }
            res.destroy()
        });
        this.server.listen(39865)
    }
    close(){
        logger.writeDebug("Manual connect server closed")
        this.server?.close();
    }
}
export default ManualConnect;