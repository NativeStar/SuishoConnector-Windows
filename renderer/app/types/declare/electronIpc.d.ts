import type {InitServerResult} from "~/types/ipc"
declare global { 
    readonly var electronMainProcess:{
        readonly isDeveloping:() => Promise<boolean>;
        readonly devtools:() => Promise<void>;
        readonly rebootServer:()=>Promise<void>;
        readonly rebootApplication:()=>Promise<void>;
        readonly closeApplication:()=>Promise<void>;
        readonly onPhoneConnected:(callback:Function)=>void;
        readonly onPhoneConnectFailed:(callback:Function)=>void;
        readonly initServer:()=>Promise<Error|InitServerResult>;
        readonly onPhoneConnected:(callback:Function)=>Promise<void>;
        readonly onPhoneConnectFailed:(callback:Function)=>Promise<void>;
        readonly detectProxy:()=>Promise<boolean>;
        readonly openProxySetting:() => Promise<void>;
        readonly getConfig:(key:string) => Promise<null|string|number|boolean>;
        readonly startAutoConnectBroadcast:() => Promise<void>;
        readonly startApkDownloadServer:() => Promise<void>;
        readonly autoConnectError:(callback:Function)=>Promise<void>;
    }
}
// declare interface Window {
//     readonly electronMainProcess:{
//         readonly isDeveloping:() => Promise<boolean>;
//         readonly devtools:() => Promise<void>;
//         readonly rebootServer:()=>Promise<void>;
//         readonly rebootApplication:()=>Promise<void>;
//         readonly closeApplication:()=>Promise<void>;
//         readonly onPhoneConnected:(callback:Function)=>void;
//         readonly onPhoneConnectFailed:(callback:Function)=>void;
//         readonly initServer:()=>Promise<Error|InitServerResult>;
//         readonly onPhoneConnected:(callback:Function)=>Promise<void>;
//         readonly onPhoneConnectFailed:(callback:Function)=>Promise<void>;
//         readonly detectProxy:()=>Promise<boolean>;
//         readonly openProxySetting:() => Promise<void>;
//         readonly getConfig:(key:string) => Promise<null|string|number|boolean>;
//         readonly startAutoConnectBroadcast:() => Promise<void>;
//         readonly startApkDownloadServer:() => Promise<void>;
//         readonly autoConnectError:(callback:Function)=>Promise<void>;
//     }
// }