export type InitServerResult={
    address:string|null,
    port:number,
    certDownloadPort:number,
    id:string
}
export type DeviceBaseInfo={
    android:number//sdk版本
    androidId:string
    model:string
    oem:string
    protocolVersion:number
    sessionId:string
}