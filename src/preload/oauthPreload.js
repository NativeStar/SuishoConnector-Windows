import { contextBridge,ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronMainProcess",{
    createCredentials:(handle)=>{ipcRenderer.on("createCredentials",handle)},
    getCredentials:(handle)=>{ipcRenderer.on("getCredentials",handle)},
    createCredentialsResult:(result)=>{ipcRenderer.send("oauth_createCredentialsCallback",result)},
    saveRawID:(buffer)=>{ipcRenderer.invoke("oauth_saveRawID",buffer)},
    setStartAuthorization:(handle)=>{ipcRenderer.on("startAuthorization",handle)},
    authorizationResult:(result=>{ipcRenderer.send("oauth_authorizationCallback",result)})
})