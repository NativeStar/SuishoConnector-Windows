const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("electronMainProcess",{
    devtools:()=>ipcRenderer.invoke("openConsole"),
    invokeCommand:(cmd,...args)=>{return ipcRenderer.invoke(cmd,...args)},
    
})