import type { InitServerResult, DeviceBaseInfo ,ApplicationListData,ApplicationNotificationProfile,TextFilterConfig, FileItem} from "~/types/ipc"
import { RightClickMenuItemId, type RightClickMenuItem } from "shared/const/RightClickMenuItems"
declare global {
    interface Window { 
        readonly electronMainProcess: {
            readonly isDeveloping: () => Promise<boolean>;
            readonly devtools: () => Promise<void>;
            readonly rebootServer: () => Promise<void>;
            readonly rebootApplication: () => Promise<void>;
            readonly closeApplication: () => Promise<void>;
            readonly initServer: () => Promise<Error | InitServerResult>;
            readonly onPhoneConnected: (callback: Function) => Promise<void>;
            readonly onPhoneConnectFailed: (callback: Function) => Promise<void>;
            readonly detectProxy: () => Promise<boolean>;
            readonly openProxySetting: () => Promise<void>;
            readonly getConfig: (key: string,defaultValue?:null|string|number|boolean) => Promise<null | string | number | boolean>;
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
            readonly generateTransmitFileURL: (fileName: string) => Promise<string>;
            readonly openInExplorer: (type: "transmitFolder" | "transmitFile", path?: string) => Promise<boolean>;
            readonly sendPacket: (packet: object) => Promise<void>;
            readonly sendRequestPacket: <T>(packet: object) => Promise<T>;
            readonly transmitUploadFile: (name: string, path: string, size: number) => Promise<void>;
            readonly openNotificationForwardConfigWindow: (pkgName?: string, appName?: string) => Promise<void>;
            readonly getDeviceDataPath: () => Promise<string>;
            readonly getAllConfig: () => Promise<{ [key: string]: string | number | boolean }>;
            readonly setConfig: (key: string, value: string | number | boolean|null) => Promise<void>;
            readonly getDeviceConfig: (key: string,defaultValue?:string|boolean|number) => Promise<null | string | number | boolean>;
            readonly getDeviceAllConfig: () => Promise<{ [key: string]: string | number | boolean }>;
            readonly setDeviceConfig: (key: string, value: string | number | boolean) => Promise<void>;
            readonly createCredentials: () => Promise<boolean>;
            readonly startAuthorization: () => Promise<boolean>;
            readonly createStartMenuShortcut: () => Promise<boolean>;
            readonly openUrl: (url: string) => Promise<void>;
            readonly openDebugPanel: () => Promise<void>;
            readonly getFilePath: (file: File) => string;
            readonly checkAndroidClientPermission: (permission: string) => Promise<{ result: boolean }>;
            readonly getPhoneDirectoryFiles: (path: string) => Promise<{code:number,files:FileItem[]}>
            readonly getPhoneIp: () => Promise<string>;
            readonly downloadPhoneFile: (path: string) => Promise<void>;
            readonly deleteLogs: () => Promise<void>;
            readonly createRightClickMenu: (menu: RightClickMenuItem[]) => Promise<RightClickMenuItemId>;
            readonly getTextFilterConfig: () => Promise<TextFilterConfig>;
            readonly changeTextFilterMode:()=>Promise<void>;
            readonly editTextFilterRule:(action:"add"|"remove",value:string)=>Promise<void>;
            readonly getNotificationProfile:(packageName:string)=>Promise<ApplicationNotificationProfile>;
            readonly setNotificationProfile:(packageName:string,profile:ApplicationNotificationProfile)=>Promise<void>;
            readonly getPackageList:(forceUpdate:boolean)=>Promise<{data:ApplicationListData[]}>,
            readonly sendMessageToMainWindow:(type:string,message:{[key:string]:string|number|boolean})=>void
            readonly appendMediaSessionControl:(action:"changePlayState"|"next"|"previous"|"seek",time?:number)=>void
        }
    }
}