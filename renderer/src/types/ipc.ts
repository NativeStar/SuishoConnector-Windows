import {TrustMode} from "shared/const/TrustMode"
export type InitServerResult = {
    address: string | null,
    port: number,
    certDownloadPort: number,
    id: string,
    pairCode:string
}
export type DeviceBaseInfo = {
    androidSdkVersion: number//sdk版本
    androidId: string
    model: string
    oem: string
    protocolVersion: number
    sessionId: string
}
export type TrustModeIpc={
    trustMode:TrustMode
}
export type ApplicationNotificationProfile = {
    enableProfile: boolean,
    enableNotification: boolean,
    enableDeepHidden: boolean,
    detailShowMode: "all" | "nameOnly" | "hide" | "none",
    enableTextFilter: boolean
    disableRecord: boolean
}
export type TextFilterConfig = {
    enable: boolean,
    enableOngoing: boolean,
    filterMode: "blacklist" | "whitelist",
    appProfile: ApplicationNotificationProfile[],
    enableTextFilter: boolean,
    filterText: string[]
}
export type ApplicationListData = {
    appName: string,
    packageName: string,
    isSystemApp: boolean
}
export type FileItem = {
    type: "folder" | "file",
    name: string,
    size: number
}
export type MediaSessionMetadata={
    title: string
    artist: string
    album: string
    image: string
    duration:number
}
export type MediaSessionState={
    hasSession:boolean
    playing:boolean
    position:number
}
export type AudioForwardResponse={
    result:boolean
    exception?:string
}