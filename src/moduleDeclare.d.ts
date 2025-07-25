// import { BrowserView } from "electron"

declare module "is-port-available"{
    export default function(port:number):Promise<boolean>
}
declare module "randomthing-js"{
    function number(min:number,max:number):number
    function number_en(length:number):string
}
declare namespace ws{
    interface WebSocket{
        write():void
    }
}