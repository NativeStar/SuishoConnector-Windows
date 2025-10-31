//ui库
//两层路径
// import * as ui from "../modules/material.js";
import * as md from "../modules/mdui.esm.js";
//阻止选择 拖出等
import antiAction from '../modules/cancelWebAction.js';
//test
import developing from "../modules/developing.js"
antiAction();
// void ui;
/* 
*/
//是否已经显示刷新提示
// let isRefreshTipShowed = false;
window.onload = onAppLoaded;
async function onAppLoaded() {
    //TODO 首次打开展示欢迎界面
    //创建主进程通知已连接的通道
    window.electronMainProcess.onPhoneConnected(onPhoneConnectedCallback);
    window.electronMainProcess.onPhoneConnectFailed(onPhoneConnectFailedCallback);
    window.electronMainProcess.autoConnectError(autoConnectErrorCallback)
    //调试
    window.electronMainProcess.isDeveloping().then(value => {
        if (value) {
            developing.inject();
        }
    });
    //初始化服务器
    initEnv()
    /* await  */initServerAndGetInformation();

}
function autoConnectErrorCallback(){
    document.getElementById("autoConnectIcon").setAttribute("name","error_outline");
    document.getElementById("autoConnectText").innerText="自动连接功能异常"
}
/**
 * @description 连接手机成功的回调
 * @param {Electron.IpcRendererEvent} event
 */
function onPhoneConnectedCallback(event) {
    document.getElementById("qrcodeMask").hidden=false;
}
/**
 *@description 连接失败的回调
 *@param {Electron.IpcRendererEvent} event 
 *@param {String} reason 错误原因 用于显示
 */
function onPhoneConnectFailedCallback(event, reason, title = "连接失败") {
    md.alert({
        headline: title,
        description: reason,
        confirmText: "确定",
        onConfirm: () => window.electronMainProcess.rebootApplication(),
    });
}
async function initServerAndGetInformation() {
    //避免后边出异常重启都不行
    document.getElementById("refreshButton").addEventListener("click",()=>{
        window.electronMainProcess.rebootApplication();
    });
    //通知主进程初始化服务器
    const openServerResult = await window.electronMainProcess.initServer();
    if (openServerResult instanceof Error) {
        if (openServerResult.message==="Clash") {
            md.alert({
                headline: "发现Clash虚拟网卡",
                description: "请将其关闭后重启软件 否则无法正常运行(即TUN模式)",
                confirmText: "关闭",
                onConfirm: () => {
                    //打开clash
                    location.href="clash://";
                    window.electronMainProcess.rebootApplication()
                }
            });
            return
        }
        // 开启服务器发生错误执行
        md.alert({
            headline: "发生异常",
            description: "请重启软件\n" + openServerResult.stack,
            confirmText: "确定",
            onConfirm: () => window.electronMainProcess.rebootApplication(),
        });
        return
    };
    //获取不到端口时
    if (openServerResult.address === null) {
        md.alert({
            headline: "发生异常",
            description: "无法获取本机IP地址\n请检查网卡及网络连接是否正常\n或向开发者反馈此问题",
            confirmText: "重启",
            onConfirm: () => window.electronMainProcess.rebootApplication(),
        });
        return
    };
    // console.log(openServerResult);
    // new QRCode("qrCodeShow", { width: 160, height: 160 ,colorDark:"#888888",colorLight:"#fdf7fe"}).makeCode(`${openServerResult.address}:${openServerResult.mainPort}`);
    //数据量有点大 二维码太小不好扫
    new QRCode("qrCodeShow", { width: 180, height: 180 ,colorDark:"#707070",colorLight:"#fdf7fe"}).makeCode(JSON.stringify(openServerResult));
    //删除title属性 防止提示挡住二维码
    document.getElementById("qrCodeShow").removeAttribute("title");
    document.getElementById("changeConnectMethodButton").addEventListener("click", () => {
        document.getElementById("changeConnectMethodButton").blur();
        md.alert({
            headline:"手动连接",
            description:`请在手机端对应位置内输入以下信息\n
            IP:${openServerResult.address}\n
            端口:39865`,
            confirmText:"确定"
        })
    });
    //apk下载
    document.getElementById("androidDownload").addEventListener("click", () => {
        window.electronMainProcess.startApkDownloadServer();
        //防止重复生成
        if (!document.getElementById("downloadApkQrCode").hasAttribute("hasQrCode")) {
            new QRCode("downloadApkQrCode", { width: 150, height: 150 ,colorDark:"#707070",colorLight:"#fdf7fe"}).makeCode(`http://${openServerResult.address}:25120/suishoPkgDownload`);
            document.getElementById("downloadApkQrCode").setAttribute("hasQrCode","")
            document.getElementById("downloadApkQrCode").removeAttribute("title");
        }
        document.getElementById("apkDownloadDiv").style.display="flex"
        document.getElementById("androidDownload").blur();
    });
    //关闭apk下载遮罩
    document.getElementById("closeApkDownloadMarkButton").addEventListener("click", () => {
        document.getElementById("apkDownloadDiv").style.display = "none";
    });
    //自动连接绑定设备 放在最后处理
    const boundDeviceId = await window.electronMainProcess.getConfig("boundDeviceId");
    //未绑定 不往下走
    if (boundDeviceId===null) return
    document.getElementById("autoConnectTip").hidden=false;
    //开始广播
    await window.electronMainProcess.startAutoConnectBroadcast();
};
/**
 *@description 更改环境
 *
 */
async function initEnv() {
    //检测代理
    if (await window.electronMainProcess.detectProxy()) {
        md.confirm({
            headline: "检测到系统代理",
            description: "应用可能无法正常工作\n请检查代理设置",
            confirmText: "打开设置",
            cancelText: "确认",
            onConfirm: () => window.electronMainProcess.openProxySetting(),
        });
    }
}
/**
 *@description 刷新页面 重启服务器
 *
 */
function reloadServer() {
    window.electronMainProcess.rebootServer();
    window.location.reload();
}