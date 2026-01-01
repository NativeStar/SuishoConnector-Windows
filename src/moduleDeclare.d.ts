// import { BrowserView } from "electron"
declare module "randomthing-js"{
    function number(min:number,max:number):number
    function number_en(length:number):string
}
declare namespace ws{
    interface WebSocket{
        write():void
    }
}