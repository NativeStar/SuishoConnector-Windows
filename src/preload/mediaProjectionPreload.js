const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("electronMainProcess",{
    isDeveloping:()=>{return ipcRenderer.invoke("isDeveloping")},
    devtools:()=>{ipcRenderer.invoke("openConsole")},
    // getScreenResolution:()=>{return ipcRenderer.invoke("main_getScreenResolution")},
    getDeviceDetailInfo:()=>{return ipcRenderer.invoke("main_getDeviceDetailInfo")},
})