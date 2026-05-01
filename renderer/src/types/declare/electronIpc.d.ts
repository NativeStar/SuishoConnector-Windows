import type { InitServerResult, DeviceBaseInfo,ApplicationNotificationProfile,TextFilterConfig, FileItem,AudioForwardResponse} from "~/types/ipc"
import { RightClickMenuItemId, type RightClickMenuItem } from "shared/const/RightClickMenuItems"
import type {ApplicationListData} from "shared"
declare global {
    interface Window { 
        readonly electronMainProcess: {
            readonly isDeveloping: () => Promise<boolean>;
            readonly devtools: () => Promise<void>;
            readonly rebootApplication: (clearConnectionCache=false) => Promise<void>;
            readonly closeApplication: () => Promise<void>;
            readonly initServer: () => Promise<InitServerResult>;
            readonly onPhoneConnected: (callback: Function) => Promise<void>;
            readonly onAutoConnectBroadcastSent:(callback: Function)=>Promise<void>
            readonly onPhoneConnectFailed: (callback: Function) => Promise<void>;
            readonly getConfig: <T=null|string|number|boolean|string[]>(key: string,defaultValue?:T) => Promise<T>;
            readonly startAutoConnectBroadcast: () => Promise<void>;
            readonly startApkDownloadServer: () => Promise<void>;
            readonly autoConnectError: (callback: Function) => Promise<void>;
            readonly setEventHandle: (callback: (_electronEvent: never, event: string, ...args: any[]) => void) => Promise<void>;
            readonly removeEventHandle: (callback: Function) => Promise<void>;
            readonly getDeviceBaseInfo: () => Promise<DeviceBaseInfo>;
            readonly getDeviceDetailInfo: () => Promise<{ batteryLevel: number, memoryInfo: { total: number, avail: number } }>;
            readonly getUserPath: () => Promise<string>;
            readonly registerFileUploadProgressListener: (callback: (_event: never, progress: number) => void) => Promise<void>;
            readonly unregisterFileUploadProgressListener: (callback: Function) => Promise<void>;
            readonly openFile: (path: string) => Promise<boolean>;
            readonly getTransmitFilePath: (fileName: string) => Promise<string>;
            readonly openInExplorer: (type: "transmitFolder" | "transmitFile", path?: string) => Promise<boolean>;
            readonly sendPacket: (packet: object) => Promise<void>;
            readonly sendRequestPacket: <T>(packet: object) => Promise<T>;
            readonly transmitUploadFile: (name: string, path: string, size: number) => Promise<void>;
            readonly openNotificationForwardConfigWindow: (pkgName?: string, appName?: string) => Promise<void>;
            readonly closeNotificationForwardConfigWindow:()=>Promise<void>;
            readonly getDeviceDataPath: () => Promise<string>;
            readonly getAllConfig: () => Promise<{ [key: string]: string | number | boolean }>;
            readonly setConfig: (key: string, value: string | number | boolean|null) => Promise<void>;
            readonly getDeviceConfig: <T=string|boolean|number|string[]>(key: string,defaultValue?:T) => Promise<T>;
            readonly getDeviceAllConfig: () => Promise<{ [key: string]: string | number | boolean }>;
            readonly setDeviceConfig: (key: string, value: string | number | boolean) => Promise<void>;
            readonly createCredentials: () => Promise<boolean>;
            readonly startAuthorization: () => Promise<boolean>;
            readonly createStartMenuShortcut: () => Promise<boolean>;
            readonly openUrl: (url: string) => Promise<void>;
            readonly getFilePath: (file: File) => string;
            readonly getPhoneIp: () => Promise<string>;
            readonly downloadPhoneFile: (path: string) => Promise<void>;
            readonly deleteCache: () => Promise<void>;
            readonly createRightClickMenu: (menu: RightClickMenuItem[]) => Promise<RightClickMenuItemId>;
            readonly getTextFilterConfig: () => Promise<TextFilterConfig>;
            readonly changeTextFilterMode:()=>Promise<void>;
            readonly editTextFilterRule:(action:"add"|"remove",value:string)=>Promise<void>;
            readonly getNotificationProfile:(packageName:string)=>Promise<ApplicationNotificationProfile>;
            readonly setNotificationProfile:(packageName:string,profile:ApplicationNotificationProfile)=>Promise<void>;
            readonly getPackageList:(forceUpdate:boolean)=>Promise<{data:ApplicationListData[]}>,
            readonly sendMessageToMainWindow:(type:string,message:{[key:string]:string|number|boolean})=>void
            readonly appendMediaSessionControl:(action:"changePlayState"|"next"|"previous"|"seek",time?:number)=>void
            readonly setAudioForwardEnable:(enable:boolean)=>Promise<AudioForwardResponse>
            readonly appendLog:(log:string[])=>Promise<void>
            readonly requestArchiveLog:()=>Promise<boolean>
            readonly setEnableFileContextMenu:(enabled:boolean)=>Promise<void>
            readonly isEnabledFileContextMenu:()=>Promise<boolean>
            readonly createCacheFile:(name:string,data:ArrayBuffer)=>Promise<string>
            readonly addWatchPath:(path:string)=>Promise<boolean>
            readonly removeWatchPath:(path:string)=>Promise<void>
            readonly showDirectoryPicker:()=>Promise<string|null>
            readonly startTransmitDragFile:(name:string)=>Promise<boolean>
            readonly deleteTransmitFile:(fileName:string)=>Promise<void>
        }
    }
}