import {Dexie} from "./dexie.mjs";
class Database{
    /**
     * @typedef {"transmit"|"notification"} DatabaseType
     * 数据库类型
     */
    /**
     * @typedef {{
     *  timestamp:number,
     *  type:"text"|"file",
     *  from:number,
     *  message ?:string,
     *  name?:string,
     *  displayName?:string,
     *  size?:number,
     *  isDeleted?:boolean,
     *  extData?:string
     *  appName?:string
     *  title?:string
     *  content?:string
     *  packageName?:string
     * }} MessageObject
     */
    /**
     * @type {Dexie}
     * @memberof DataStorage
     */
    static #dataBase;
    static #initd = false;
    static async init(){
        if(this.#initd) {
            console.log("Database already init");
            return
        }
        const deviceBaseInfo = await window.electronMainProcess.getDeviceBaseInfo();
        this.#dataBase = new Dexie(deviceBaseInfo.androidId);
        this.#dataBase.version(1).stores({
            transmit:"&timestamp,type,message,from,name,displayName,size,isDeleted,extData",
            notification:"&timestamp,appName,title,content,packageName,extData"
        });
        this.#initd=true;
        console.log("Database init success");
    }
    /**
     * 
     * @param {DatabaseType} type 
     * @returns {Promise<MessageObject[]>}
     */
    static async getAllData(type){
        if (!this.#initd) {
            console.warn("Call init method first!!!");
            return null;
        }
        return await this.#dataBase[type].toArray();
    }
    /**
     * 
     * @param {DatabaseType} type 
     * @param {MessageObject} data 
     */
    static async addData(type,data){
        if (!this.#initd) {
            console.warn("Call init method first!!!");
            return null;
        }
        await this.#dataBase[type].add(data);
    }
    /**
     * 
     * @param {DatabaseType} type 
     * @param {number} timestamp 
     */
     static async deleteData(type,timestamp){
        if (!this.#initd) {
            console.warn("Call init method first!!!");
            return null;
        }
        await this.#dataBase[type].delete(timestamp);
    }
    /**
     * 
     * @param {DatabaseType} type 
     */
    static async clearData(type){
        if (!this.#initd) {
            console.warn("Call init method first!!!");
            return null;
        }
        return await this.#dataBase[type].clear();
    }
     /**
     * @param {DatabaseType} type 
     * @param {number} timestamp 
     * @returns  {Promise<MessageObject|undefined>}
     */
    static async getData(type,timestamp){
        if (!this.#initd) {
            console.warn("Call init method first!!!");
            return null;
        }
        return await this.#dataBase[type].get(timestamp);
    }
    /**
     * 
     * @param {DatabaseType} type 
     * @param {MessageObject} data 
     * @returns 
     */
    static async putData(type,data){
        if (!this.#initd) {
            console.warn("Call init method first!!!");
            return null;
        }
        return await this.#dataBase[type].put(data);
    }
    
}
export default Database;