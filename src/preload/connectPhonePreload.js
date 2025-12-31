const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("electronMainProcess",{
    isDeveloping:()=>{return ipcRenderer.invoke("isDeveloping")},
    devtools:()=>ipcRenderer.invoke("openConsole"),
    //重启服务器 防止端口冲突
    rebootServer:()=>ipcRenderer.invoke("rebootServer"),
    //重启软件
    rebootApplication:()=>{ipcRenderer.send("reboot_application")},
    //退出
    closeApplication:()=>{ipcRenderer.send("close_application")},
    //初始化
    initServer:()=>{return ipcRenderer.invoke("connectPhone_initServer")},
    //连接成功回调
    onPhoneConnected:callback=>{ipcRenderer.on("connectPhone_connected",callback)},
    //连接失败回调
    onPhoneConnectFailed:callback=>{ipcRenderer.on("connectPhone_connectFailed",callback)},
    //检测系统代理
    detectProxy:()=>{return ipcRenderer.invoke("connectPhone_detectProxy")},
    //打开代理设置
    openProxySetting:()=>{ipcRenderer.send("connectPhone_openProxySetting")},
    //获取配置信息
    getConfig:(prop,defaultValue)=>{return ipcRenderer.invoke("main_getConfig",prop,defaultValue)},
    //开始自动连接广播
    startAutoConnectBroadcast:()=>{ipcRenderer.send("main_startAutoConnectBroadcast")},
    //开启apk下载服务器
    startApkDownloadServer:()=>{ipcRenderer.invoke("main_startApkDownloadServer")},
    //隐藏自动连接提示
    autoConnectError:callback=>{ipcRenderer.on("main_autoConnectError",callback)},
    
})