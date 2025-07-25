import NotificationDetail from "../../modules/element/NotificationDetail.js"
import FileManager from "../../js/init/fileManagerInit.js";
import MessageTransmit from "../../js/init/transmitInit.js";
import NotificationPage from "../../js/init/notificationForwardInit.js";
import State from "../../modules/element/State.js";
function customElementInit() {
    customElements.define("suisho-notification-detail",NotificationDetail);
    customElements.define("suisho-state-card",State);
}
function controlInit() {
    //打开debug面板
    const konamiCode=[
        "ArrowUp",
        "ArrowUp",
        "ArrowDown",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowLeft",
        "ArrowRight",
        "b",
        "a"
    ];
    let inputIndex=0;
    document.addEventListener("mousedown",event=>{
        if (event.button===1) {
            event.preventDefault()
        }
    });
    //窗口焦点事件 改变标题文本颜色
    window.addEventListener("focus",()=>{
        document.getElementById("titleBar").classList.add("titleBarNotFocus");
    });
    window.addEventListener("blur",()=>{
        document.getElementById("titleBar").classList.remove("titleBarNotFocus");
    });
    document.getElementById("titleBar").addEventListener("click",event=>{
        if (event.button===2) {
            event.preventDefault();
        }
    });
    //打开搜索快捷键
    addEventListener("keyup",(event)=>{
        if (event.key.toLowerCase()==="f"&&event.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
            const railItems=document.getElementsByTagName("mdui-navigation-rail-item");
            for (const element of railItems) {
                if (element.hasAttribute("active")) {
                    switch (element.getAttribute("value")) {
                        case "fileManager":
                            FileManager.requestFilterCard();
                            break;
                        case "transmit":
                            MessageTransmit.requestFilterCard();
                            break
                        case "notificationForward":
                            NotificationPage.requestFilterCard();
                        case "home":
                            break
                        default:
                            console.warn("Error active rail item!");
                            break;
                    }
                    break;
                }
            }
            // document.getElementById("notificationForwardSearchInput").focus();
        }
    });
    //禁用tab键 bug太多了
    document.addEventListener("keydown",event=>{
        if (event.key==="Tab") {
            event.preventDefault();
            event.stopPropagation();
        }
    });
    //debug panel
    document.getElementById("transmit_text_input").addEventListener("keyup",event=>{
        if (event.key===konamiCode[inputIndex]) {
            inputIndex++;
            if (inputIndex===10) {
                inputIndex=0;
                window.electronMainProcess.openDebugPanel();
            }
        }
    })
}
export {
    customElementInit,
    controlInit
}