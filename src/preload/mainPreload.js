const {contextBridge,ipcRenderer,webUtils}=require("electron");
contextBridge.exposeInMainWorld("electronMainProcess",{
    isDeveloping:()=>{return ipcRenderer.invoke("isDeveloping")},
    devtools:()=>{ipcRenderer.invoke("openConsole")},
    rebootApplication:()=>{ipcRenderer.send("reboot_application")},
    closeApplication:()=>{ipcRenderer.send("close_application")},
    setEventHandle:handle=>{ipcRenderer.on("webviewEvent",handle)},
    removeEventHandle:handle=>{ipcRenderer.removeListener("webviewEvent",handle)},
    //基础信息
    getDeviceBaseInfo:()=>{return ipcRenderer.invoke("main_getDeviceBaseInfo")},
    //详细信息
    getDeviceDetailInfo:()=>{return ipcRenderer.invoke("main_getDeviceDetailInfo")},
    //返回数据
    getUserPath:()=>{return ipcRenderer.invoke("main_getUserPath")},
    //返回互传数据
    // getTransmitMessages:()=>{return ipcRenderer.invoke("main_getTransmitMessages")},
    //存盘
    // writeFile:(path,data)=>{return ipcRenderer.invoke("main_writeFile",path,data)},
    // 文件上传进度
    registerFileUploadProgressListener:handle=>{ipcRenderer.on("fileUploadProgressUpdate",handle)},
    unregisterFileUploadProgressListener:handle=>{ipcRenderer.removeListener("fileUploadProgressUpdate",handle)},
    //打开文件
    openFile:(file)=>{return ipcRenderer.invoke("main_shellOpenFile",file)},
    //拖出文件
    generateTransmitFileURL:(file)=>{return ipcRenderer.invoke("transmit_generateTransmitFileURL",file)},
    //在资源管理器中打开
    openInExplorer:(type,path)=>{return ipcRenderer.invoke("main_openInExplorer",type,path)},
    //发送数据包 不带响应
    sendPacket:data=>ipcRenderer.invoke("main_sendPacket",data),
    //发送请求包
    sendRequestPacket:(data)=>{return ipcRenderer.invoke("main_sendRequestPacket",data)},
    //互传 上传文件
    transmitUploadFile:(name,path,size,form=1)=>ipcRenderer.invoke("transmit_uploadFile",name,path,size,form),
    //打开通知转发配置页
    openNotificationForwardConfigWindow:(pkgName,appName)=>{ipcRenderer.invoke("notification_openConfigWindow",pkgName,appName)},
    //获取设备数据路径
    getDeviceDataPath:()=>{return ipcRenderer.invoke("main_getDeviceDataPath")},
    //获取配置信息
    getConfig:(prop)=>{return ipcRenderer.invoke("main_getConfig",prop)},
    //获取所有配置
    getAllConfig:()=>{return ipcRenderer.invoke("main_getAllConfig")},
    //写入配置
    setConfig:(prop,value)=>{return ipcRenderer.invoke("main_setConfig",prop,value)},
    //获取设备设置
    getDeviceConfig:(prop)=>{return ipcRenderer.invoke("main_getDeviceConfig",prop)},
    //获取设备所有配置
    getDeviceAllConfig:()=>{return ipcRenderer.invoke("main_getDeviceAllConfig")},
    //写入设备配置
    setDeviceConfig:(prop,value)=>{return ipcRenderer.invoke("main_setDeviceConfig",prop,value)},
    //获取应用通知配置
    getNotificationProfile:(pkg)=>{return ipcRenderer.invoke("notificationForward_getProfile",pkg)},
    //创建凭证
    createCredentials:()=>{return ipcRenderer.invoke("main_createCredentials")},
    //验证凭证
    startAuthorization:()=>{return ipcRenderer.invoke("main_startAuthorization")},
    //创建开始菜单快捷方式
    createStartMenuShortcut:()=>{return ipcRenderer.invoke("main_createStartMenuShortcut")},
    //native右键菜单
    createRightClickMenu:(itemList)=>{return ipcRenderer.invoke("main_createRightClickMenu",itemList)},
    //使用浏览器打开url
    openUrl:(url)=>{ipcRenderer.send("main_openUrl",url)},
    //打开调试面板
    openDebugPanel:()=>{ipcRenderer.invoke("main_openDebugPanel")},
    //获取文件路径
    getFilePath:(file)=>{return webUtils.getPathForFile(file)},
    //检查安卓端权限
    checkAndroidClientPermission:(permission)=>{return ipcRenderer.invoke("main_checkAndroidClientPermission",permission)},
    //获取目录文件列表
    getPhoneDirectoryFiles:(path)=>{return ipcRenderer.invoke("file_listDir",path)},
    //获取手机ip
    getPhoneIp:()=>{return ipcRenderer.invoke("main_getPhoneIp")},
    //下载手机文件
    downloadPhoneFile:(downloadPath)=>{return ipcRenderer.send("main_downloadPhoneFile",downloadPath)},
    //控制音频转发开关
    setAudioForwardEnable:(enabled)=>{return ipcRenderer.invoke("main_setAudioForward",enabled)},
    //清除日志
    deleteLogs:()=>{return ipcRenderer.invoke("main_deleteLogs")},
})