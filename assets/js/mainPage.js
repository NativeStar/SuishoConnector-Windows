//ui库
import * as md from "../modules/mdui.esm.js";
//其他
import Util from "../modules/Util.js";
import Widget from "../modules/Widgets.js";
// import Database from "../modules/Database.js";
import TransmitPage from "./init/transmitInit.js";
import NotificationPage from "./init/notificationForwardInit.js";
import SettingsPage from "./init/settingsInit.js"
import stateBarInit from "./init/stateBarInit.js";
import ExtensionPage from './init/extensionInit.js';
import fileManagerInit from "./init/fileManagerInit.js";
import Database from "../modules/Database.js";
import { customElementInit, controlInit } from './init/mainPageInit.js';
//调试
import developing from "../modules/developing.js";
import StateBarInit from "./init/stateBarInit.js";
import TrustMode from './class/TrustMode.js';
import RightClickMenus from "./class/RightClickMenus.js";
import RightClickMenuItem from "./class/RightClickMenuItem.js";
const functionPages = document.getElementsByClassName("functionsPage");
//主题色
md.setColorScheme('#895cad');
window.deviceAndroidId = "";
//程序状态
const applicationState = {
    // 满电提醒避免多次推送
    batteryFulled: false,
    //是否已初始化过电量 首次连接即满电时不推送
    initializedBatteryLevel: false,
    showedConfirmDialog: false,
}
window.addEventListener("load", () => {
    //开发用功能
    window.electronMainProcess.isDeveloping().then(value => {
        if (value) {
            developing.inject();
        }
    });
    envInit();
});
//切换页面
function changePage(pageId = "0") {
    //设置按钮点击
    if (pageId === "4") {
        //移除其他页面激活效果
        for (const item of document.querySelectorAll("mdui-navigation-rail-item")) {
            item.removeAttribute("active");
            item.removeAttribute("focused")
        }
    } else {
        document.getElementById("settingPageButton").removeAttribute("selected");
    }
    //注意是字符串
    for (const page of functionPages) {
        //文件管理页特殊处理
        if (page.getAttribute("pageId") === pageId) {
            if (pageId === "3") {
                const pageElement = document.getElementById("fileManagerPage");
                pageElement.style.display = "flex";
                if (!pageElement.hasAttribute("initd")) {
                    fileManagerPageInit();
                    pageElement.setAttribute("initd", "");
                }
                return
            } else {
                document.getElementById("fileManagerPage").style.display = "none";
            }
            //避免切换到0时其他页面不被隐藏
            if (pageId === "0") {
                for (const needHiddenPage of functionPages) {
                    needHiddenPage.hidden = true;
                    needHiddenPage.removeAttribute("active");
                }
            }
            //如果已经选中 对部分功能页执行滚动到底部
            if (page.hasAttribute("active")) {
                if (pageId === "1") {
                    document.getElementById("messageList").scrollTo({ top: document.getElementById("messageList").scrollHeight })
                    //互传
                } else if (pageId === "2") {
                    //通知转发
                    document.getElementById("forwardedNotificationsList").scrollTo({ top: document.getElementById("forwardedNotificationsList").scrollHeight })
                }
                return
            }
            page.hidden = false;
            page.setAttribute("active", "");
            //文件管理页面要用display
            //初始化 获取window上的方法
            const method = window[page.getAttribute("initHandle")];
            //已初始化完成或无对应方法
            if (!page.hasAttribute("initd") && method != undefined) {
                method();
                page.setAttribute("initd", "")
            }
            return
        } else {
            page.hidden = true;
            page.removeAttribute("active");
        }
    }
}
window.changePage = changePage;
/**
 *@description 环境初始化
 */
async function envInit() {
    customElementInit();
    settingsInit();
    stateBarInit.onAppLoaded();
    window.electronMainProcess.setEventHandle(electronEventHandle);
    try {
        await Database.init();
    } catch (error) {
        console.error(error);
        stateBarInit.addState("error_database_init");
    }
    homePageInit();
    clipboardInit();
    TransmitPage.init();
    controlInit();
    NotificationPage.onAppLoaded();
    SettingsPage.onAppLoaded();
    ExtensionPage.init();
    //调试面板用
    addEventListener("message", (event) => {
        let dataObj = {};
        try {
            dataObj = JSON.parse(event.data);
        } catch (error) { return };
        if (dataObj.type === "debug") {
            switch (dataObj.action) {
                case "callElectronEvent":
                    electronEventHandle(null, event.eventType, event.args);
                    break;
                default:
                    break;
            }
        }
    })
}
/**
 * @description 主页初始化
 */
async function homePageInit() {
    //将设备信息对象挂上全局
    window.deviceInfo = {};
    //获取基础信息
    const deviceBaseInfo = await window.electronMainProcess.getDeviceBaseInfo();
    //异步获取详细信息
    window.electronMainProcess.getDeviceDetailInfo().then(value => {
        document.getElementById("batteryLevelText").innerText = `${value.batteryLevel}%`;
        document.getElementById("memInfoText").innerText = `${parseInt(((value.memoryInfo.total - value.memoryInfo.avail) / value.memoryInfo.total) * 100)}%`;
        window.deviceInfo.screenWidth = value.screenWidth;
        window.deviceInfo.screenHeight = value.screenHeight;
        //额外显示通讯延迟 
    }).catch(reason => {
        md.alert({
            headline: "获取设备详细状态失败",
            description: reason,
            confirmText: "确定",
            onConfirm: () => { }
        });
        document.getElementById("batteryLevelText").innerText = "N/A";
        document.getElementById("memInfoText").innerText = "N/A";
        document.getElementById("batteryTempText").innerText = "N/A";
    });
    //设置androidID
    deviceAndroidId = deviceBaseInfo.androidId;
    //主页标题
    document.getElementById("modelNameText").innerText = `${deviceBaseInfo.model}`;
    //获取信任模式
    const trust = await window.electronMainProcess.sendRequestPacket({ packetType: "main_getTrustMode" });
    if (trust.trustMode === TrustMode.TRUST_UNSELECT) {
        //未选择

    } else if (trust.trustMode === TrustMode.TRUST_UNTRUSTED) {
        //不信任
        stateBarInit.addState("info_device_not_trusted");
    }
    document.getElementById("home_test_speaker").addEventListener("click",()=>{
        window.electronMainProcess.setAudioForwardEnable(true);
    })
}
//其他 与交互有关
/**
 *
 * @description 重启客户端 可选进行弹窗
 * @param {String|null} [alertTitle=null]
 * @param {String} alertText
 * @param {String} alertButtonText
 */
function rebootApplication(alertTitle = null, alertText, alertButtonText) {
    if (alertTitle != null) {
        md.alert({
            headline: alertTitle,
            description: alertText,
            confirmText: alertButtonText,
            onConfirm: () => window.electronMainProcess.rebootApplication()
        })
        return
    }
    //跳过对话框 直接重启
    window.electronMainProcess.rebootApplication();
}
/**
 *@description 主进程事件处理
 * @param {{type:String}} event
 */
function electronEventHandle(electronEvent, event, ...args) {
    console.log(electronEvent, event, args);
    switch (event) {
        //掉线
        case "disconnect":
            document.body.classList.add("noScroll");
            document.addEventListener("scroll", event => event.preventDefault());
            rebootApplication("通讯中断", args && args[0] !== "" ? args[0] : "由于未知原因 连接断开", "确定");
            break;
        //纯弹窗 仅提示功能那种
        case "showAlert":
            md.alert({
                headline: args[0],
                description: args[1],
                confirmText: "确定",
                onConfirm: () => { },
            });
            break
        //互传追加文本
        case "transmit_appendPlainText":
            TransmitPage.appendPlainText(args[0]);
            break
        //互传追加上传中文件
        case "transmit_appendFile":
            TransmitPage.appendFile(args[0], args[1], args[2]);
            break
        //互传文件上传成功
        case "transmit_fileUploadSuccess":
            TransmitPage.onFileUploadSuccess(args[0], args[1], args[3]);
            break
        //互传文件上传失败
        case "transmit_fileTransmitFailed":
            TransmitPage.onFileUploadFailed(args[0], args[1]);
            break
        //追加通知显示
        case "notification_append":
            NotificationPage.appendNotification(args[0], args[1], args[2], args[3], args[4]);
            break
        case "focus_notification":
            //模拟点击 方便快捷
            document.getElementById("rail_notification_forward_button").click();
            //通知列表拉到底部
            document.getElementById("forwardedNotificationsList").scrollTo({ top: document.getElementById("forwardedNotificationsList").scrollHeight })
            break
        case "add_state":
            //添加和移除状态
            StateBarInit.addState(args[0]);
            break
        case "remove_state":
            StateBarInit.removeState(args[0]);
            break
        case "trustModeChange":
            // 更新状态
            args[0] ? StateBarInit.removeState("info_device_not_trusted") : StateBarInit.addState("info_device_not_trusted");
            break
        case "updateDeviceState":
            document.getElementById("batteryLevelText").innerText = `${args[0].batteryLevel}%`;
            document.getElementById("memInfoText").innerText = `${parseInt(((args[0].memInfo.total - args[0].memInfo.avail) / args[0].memInfo.total) * 100)}%`;
            document.getElementById("batteryTempText").innerText = `${(args[0].batteryTemp / 10)}°C`;
            document.getElementById("batteryChargingIcon").setAttribute("name", args[0].charging ? "battery_charging_full" : "battery_full");
            //满电提醒
            //要求电量100 正在充电 且开启提醒
            (async () => {
                //单次满电只推送一次 掉电后更改满电标记
                if (args[0].batteryLevel >= 100 && applicationState.batteryFulled) return
                if (args[0].batteryLevel >= 100 && args[0].charging && await window.electronMainProcess.getDeviceConfig("enableBatteryFullNotification")) {
                    if (!applicationState.initializedBatteryLevel) {
                        //直接用web自带足矣
                        new Notification("手机满电提醒", {
                            body: "设备电量已满"
                        });
                    }
                    applicationState.batteryFulled = true;
                    applicationState.initializedBatteryLevel = true;
                    return
                }
                //掉电时恢复推送标记
                if (args[0].batteryLevel <= 99) applicationState.batteryFulled = false;
            })();
            break
        case "updateNetworkLatency":
            document.getElementById("connectionLatencyText").innerText = `${args[0]}ms`;
            break
        case "client_function_state_change":
            console.log(args);
            break
        case "transmit_upload_file":
            TransmitPage.addUploadingFileView(args[0], args[1], args[2]);
            //直接changePage会导致激活的菜单项错误
            document.getElementById("rail_item_transmit").click();
            break
        case "showSnakeBar":
            md.snackbar({ message: args[0] });
            break
        case "setElementText":
            document.getElementById(args[0]).innerText = args[1];
            break
        case "rebootConfirm":
            if (applicationState.showedConfirmDialog) {
                md.snackbar({
                    message: "当前已有对话框",
                    timeout: 1500
                });
            }
            applicationState.showedConfirmDialog = true;
            md.confirm({
                headline: "重启程序",
                description: "确认重启程序?所有连接将关闭",
                confirmText: "重启",
                cancelText: "取消",
                onConfirm: () => {
                    window.electronMainProcess.rebootApplication();
                },
                onCancel: () => {
                    applicationState.showedConfirmDialog = false;
                }
            });
            break;
        case "closeConfirm":
            if (applicationState.showedConfirmDialog) {
                md.snackbar({
                    message: "当前已有对话框",
                    timeout: 1500
                });
                return
            }
            applicationState.showedConfirmDialog = true;
            md.confirm({
                headline: "关闭程序",
                description: "确认关闭程序?",
                confirmText: "关闭",
                cancelText: "取消",
                onConfirm: () => {
                    window.electronMainProcess.closeApplication();
                },
                onCancel: () => {
                    applicationState.showedConfirmDialog = false;
                }
            });
            break
        default:
            console.warn("Unknown event type" + event);
            break;
    }
}
/**
 *@description 剪切板操作快捷键处理 防止把背景样式复制进去
 */
function clipboardInit() {
    //监听复制快捷键
    document.addEventListener("keydown", event => {
        if (event.key.toUpperCase() === "C" && event.ctrlKey) {
            //阻止系统操作复制
            event.stopPropagation();
            event.stopImmediatePropagation();
            event.preventDefault();
            //写入
            navigator.clipboard.writeText(getSelection().toString())
        }
    })
}
/**
 * 设置初始化
 */
function settingsInit() {
    //按钮
    document.getElementById("settingPageButton").addEventListener("click", event => {
        changePage("4");
        event.target.setAttribute("selected", "");
        // 防止页面重新获得焦点时弹出个提示
        event.target.blur();
    });
}
//通知转发初始化
window.notificationForwardInit = () => {
    NotificationPage.init();
}
//文件管理页初始化
async function fileManagerPageInit() {
    fileManagerInit.init();
}
//通过资源管理器上传文件
/**
 * @param {HTMLInputElement} element 
 */
window.onUploadFileSelected = (element) => {
    TransmitPage.addUploadingFileView(element.files[0].name, window.electronMainProcess.getFilePath(element.files[0]), element.files[0].size);
    //文件名重复时使onchange正常触发
    element.value = "";
};