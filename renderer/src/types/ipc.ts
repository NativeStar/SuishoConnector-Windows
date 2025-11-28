export type InitServerResult = {
    address: string | null,
    port: number,
    certDownloadPort: number,
    id: string
}
export type DeviceBaseInfo = {
    android: number//sdk版本
    androidId: string
    model: string
    oem: string
    protocolVersion: number
    sessionId: string
}
export type ApplicationNotificationProfile = {
    enableProfile: boolean,
    enableNotification: boolean,
    detailShowMode: "all" | "nameOnly" | "hide" | "none",
    enableTextFilter: boolean
    disableRecord: boolean
}
export type TextFilterConfig = {
    _cfgVersion: number,
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