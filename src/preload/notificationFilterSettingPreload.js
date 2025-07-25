const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("electronMainProcess",{
    isDeveloping:()=>{return ipcRenderer.invoke("isDeveloping")},
    devtools:()=>ipcRenderer.invoke("openConsole"),
    //获取文本过滤配置
    getTextFilterConfig:()=>ipcRenderer.invoke("notificationForward_getTextFilterConfig"),
    //在黑白名单模式间切换
    changeTextFilterMode:()=>{ipcRenderer.invoke("notificationForward_changeTextFilterMode")},
    //编辑文本过滤配置
    editTextFilterRule:(action,value)=>{ipcRenderer.invoke("notificationForward_editTextFilterRule",action,value)},
    //发送请求包
    sendRequestPacket:(data)=>{return ipcRenderer.invoke("main_sendRequestPacket",data)},
    //获取设备数据路径
    getDeviceDataPath:()=>{return ipcRenderer.invoke("main_getDeviceDataPath")},
    //获取通知配置
    getProfile:(pkg)=>{return ipcRenderer.invoke("notificationForward_getProfile",pkg)},
    //设置通知配置
    saveProfile:(pkg,profile)=>{return ipcRenderer.invoke("notificationForward_saveProfile",pkg,profile)},
    //获取应用列表
    getPackageList:(forceUpdate)=>{return ipcRenderer.invoke("notificationForward_getPackageList",forceUpdate)},
})