export interface TransmitTextMessage{
    timestamp:number,
    type:"text",
    from:"computer"|"phone",
    message:string
}
export interface TransmitFileMessage{
    timestamp:number,
    type:"file",
    from:"computer"|"phone",
    displayName:string,
    size:number,
    name:string,
    isDeleted:boolean
}
export interface NotificationItem{
    timestamp:number,
    appName:string,
    title:string,
    content:string,
    packageName:string
}