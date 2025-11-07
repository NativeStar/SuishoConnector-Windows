import type {InitServerResult,DeviceBaseInfo} from "~/types/ipc"
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
        readonly setEventHandle:(callback:(_electronEvent:never,event:string,...args:any[])=>void)=>Promise<void>;
        readonly removeEventHandle:(callback:Function)=>Promise<void>;
        readonly getDeviceBaseInfo:() => Promise<DeviceBaseInfo>;
        readonly getDeviceDetailInfo:()=>Promise<{batteryLevel:number,memoryInfo:{total:number,avail:number}}>;
        readonly getUserPath:() => Promise<string>;
        readonly fileUploadProgress:(callback:Function)=>Promise<void>;
        readonly openFile:(path:string)=>Promise<boolean>;
        readonly generateTransmitFileURL:(path:string)=> Promise<string>;
        readonly openInExplorer:(type:"transmitFolder"|"transmitFile", path:string) => Promise<boolean>;
        readonly sendPacket:(packet:object)=> Promise<void>;
        readonly sendRequestPacket:<T>(packet:object)=> Promise<T>;
        readonly transmitUploadFile:(path:string, name:string, size:number, form:number)=> Promise<void>;
        readonly openNotificationForwardConfigWindow:(pkgName?:string,appName?:string)=>Promise<void>;
        readonly getDeviceDataPath:()=> Promise<string>;
        readonly getConfig:(key:string)=> Promise<null|string|number|boolean>;
        readonly getAllConfig:()=>Promise<{[key:string]:string|number|boolean}>;
        readonly setConfig:(key:string, value:string|number|boolean)=> Promise<void>;
        readonly getDeviceConfig:(key:string)=> Promise<null|string|number|boolean>;
        readonly getDeviceAllConfig:()=>Promise<{[key:string]:string|number|boolean}>;
        readonly setDeviceConfig:(key:string, value:string|number|boolean)=> Promise<void>;
        readonly getNotificationProfile:(pkg:string)=>Promise<null|object>;
        readonly createCredentials:()=>Promise<boolean>;
        readonly startAuthorization:()=>Promise<boolean>;
        readonly createStartMenuShortcut:()=>Promise<boolean>;
        readonly createStartMenuShortcut:(listItem:{id:string,label:string}[])=>Promise<number>;
        readonly openUrl:(url:string)=>Promise<void>;
        readonly openDebugPanel:()=> Promise<void>;
        readonly getFilePath:(file:string)=>Promise<string>;
        readonly checkAndroidClientPermission:(permission:string)=>Promise<{result:boolean}>;
        readonly getPhoneDirectoryFiles:(path:string)=>Promise<{code:number,data:{type:"folder"|"file",name:string,size:number}[]}>
        readonly openRemoteMediaPlayerWindow:(type:"audio"|"video"|"image")=>Promise<void>;
        readonly getPhoneIp:()=>Promise<string>;
        readonly downloadPhoneFile:(path:string)=>Promise<void>;
        readonly deleteLogs:()=>Promise<void>
    }
}