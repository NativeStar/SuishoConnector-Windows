import ws from "ws";
import rt from "randomthing-js";
interface sendableObject {
    _request_id?: string,
    port?:number
    fileName?:string
    fileSize?:number
    packetType?:string
    [name: string]:boolean|string|number|undefined|Object
}
interface requestObject {
    resolve: Function;
    reject: Function;
    time: number;
    id: string;
}
class rm {
    private socket: ws;
    private responseMap: Map<string, requestObject>;
    /**
     * Creates an instance of rm.
     * @param {ws} socket 发送数据用socket
     * @memberof rm
     */
    constructor(socket: ws) {
        this.socket = socket;
        /**
         * @type {Map<String,requestObject>}
         */
        this.responseMap = new Map();
        this.initTimeoutClearer();
        logger.writeInfo("Response manager init success!");
    }
    /**
     * 发送数据并异步等待 返回Promise
     */
    async send(data: sendableObject): Promise<requestObject> {
        let id:string;
        //推入的对象
        const putObj = <requestObject>{};
        //检查是否有返回id
        if (!Reflect.has(data, "_request_id")) {
            //无则创建
            id = rt.number_en(16);
            data["_request_id"] = id;
        } else {
            //有则获取
            id = data["_request_id"] as string;
        }
        const exec = new Promise((resolve, reject) => {
            //调用对象内resolve方法即完成
            putObj.resolve = resolve;
            putObj.reject = reject;
            putObj.time = Date.now();
            putObj.id = <string>id;
        });
        //推入map
        this.responseMap.set(id, putObj);
        logger.writeDebug(`Send request packet :${data.packetType}`)
        this.socket.send(JSON.stringify(data));
        //返回 用于await
        return <Promise<requestObject>>exec
    }
    /**
     *
     * @description 删除请求 不再理会响应
     * @param {string} id 请求id
     * @param {boolean} [reject=false] 是否执行请求的reject
     * @returns {boolean} 是否成功删除
     * @memberof rm
     */
    cancel(id: string, reject: boolean = false): boolean {
        if (reject && this.responseMap.has(id)) {
            this.responseMap.get(id)?.reject(new Error("Request Cancel"));
        }
        logger.writeDebug(`Canceled request packet. id:${id}`)
        return this.responseMap.delete(id);
    }
    /**
     * @param {String} id
     * @param {String} data 
     * @memberof rm
     */
    // 在主接收消息回调中检查是否为返回信息
    onResponseMessage(id: string, data: string) {
        if (this.responseMap.has(id)) {
            logger.writeDebug(`Packet id:${id} responded`);
            const targetResponse = this.responseMap.get(id);
            (targetResponse as requestObject).resolve(data);
            this.responseMap.delete(id);
        }else{
            logger.writeInfo(`Packet id:${id} not found`);
        }
    }

    /**
     * @private
     * @description 定时清理超时返回等待对象
     * @memberof rm
     */
    private initTimeoutClearer() {
        setInterval(() => {
            for (const waitingResponse of this.responseMap) {
                //超时60s
                if (Date.now() - waitingResponse[1].time >= 60000) {
                    logger.writeWarn(`Packet id:${waitingResponse[1].id} request failed by timeout`);
                    //执行失败方法
                    waitingResponse[1].reject("RequestTimeout");
                    //在队列中删除
                    this.responseMap.delete(waitingResponse[1].id);
                }
            }
        }, 30 * 1000);
    }
}
// module.exports = rm;
export default rm;