import NotificationDetail from "../../modules/element/NotificationDetail.js"
import ActiveNotification from "../../modules/element/ActiveNotification.js";
import FileManager from "../../js/init/fileManagerInit.js";
import MessageTransmit from "../../js/init/transmitInit.js";
import NotificationPage from "../../js/init/notificationForwardInit.js";
import State from "../../modules/element/State.js";
let deviceDataPath = null;
function customElementInit() {
    customElements.define("suisho-notification-detail", NotificationDetail);
    customElements.define("suisho-state-card", State);
    customElements.define("suisho-active-notification", ActiveNotification);
}
function controlInit() {
    //打开debug面板
    const konamiCode = [
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
    let inputIndex = 0;
    document.addEventListener("mousedown", event => {
        if (event.button === 1) {
            event.preventDefault()
        }
    });
    //窗口焦点事件 改变标题文本颜色
    window.addEventListener("focus", () => {
        document.getElementById("titleBar").classList.add("titleBarNotFocus");
    });
    window.addEventListener("blur", () => {
        document.getElementById("titleBar").classList.remove("titleBarNotFocus");
    });
    document.getElementById("titleBar").addEventListener("click", event => {
        if (event.button === 2) {
            event.preventDefault();
        }
    });
    //打开搜索快捷键
    addEventListener("keyup", (event) => {
        if (event.key.toLowerCase() === "f" && event.ctrlKey) {
            event.preventDefault();
            event.stopPropagation();
            const railItems = document.getElementsByTagName("mdui-navigation-rail-item");
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
    document.addEventListener("keydown", event => {
        if (event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
        }
    });
    //debug panel
    document.getElementById("transmit_text_input").addEventListener("keyup", event => {
        if (event.key === konamiCode[inputIndex]) {
            inputIndex++;
            if (inputIndex === 10) {
                inputIndex = 0;
                window.electronMainProcess.openDebugPanel();
            }
        }
    })
}
async function activeNotificationInit() {
    const reqPacket = {
        packetType: "main_getCurrentNotificationsList"
    };
    if (deviceDataPath === null) {
        deviceDataPath = await window.electronMainProcess.getDeviceDataPath();
    }
    return new Promise(resolve => {
        setTimeout(() => {
            window.electronMainProcess.sendRequestPacket(reqPacket).then(response => {
                const listFragment = document.createDocumentFragment();
                for (const notificationItem of response.list) {
                    const notificationElement = new ActiveNotification(deviceDataPath, notificationItem.packageName,notificationItem.isOngoing);
                    notificationElement.setAttribute("notification-key", notificationItem.key);
                    notificationElement.setAttribute("notification-title", notificationItem.title);
                    notificationElement.setAttribute("notification-content", notificationItem.content);
                    notificationElement.setAttribute("app-name", notificationItem.appName);
                    listFragment.append(notificationElement);
                    setTimeout(() => {
                        if (notificationElement.requestSpread()) {
                            notificationElement.setSpread();
                        }
                    }, 500);
                }
                document.getElementById("activeNotificationsList").append(listFragment);
                resolve(null)
            });
        }, 350);

    });
}
async function appendActiveNotification(pkgName, title, content, appName, key,ongoing) {
    if (deviceDataPath === null) {
        deviceDataPath = await window.electronMainProcess.getDeviceDataPath();
    }
    const element = new ActiveNotification(deviceDataPath, pkgName,ongoing);
    element.setAttribute("notification-key", key);
    element.setAttribute("notification-title", title);
    element.setAttribute("notification-content", content);
    element.setAttribute("app-name", appName);
    document.getElementById("activeNotificationsList").append(element);
    setTimeout(() => {
        if (element.requestSpread()) {
            element.setSpread();
        }
    }, 300);
}
export {
    customElementInit,
    controlInit,
    activeNotificationInit,
    appendActiveNotification
}