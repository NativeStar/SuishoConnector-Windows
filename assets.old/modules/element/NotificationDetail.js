import RightClickMenuItem from "../../js/class/RightClickMenuItem.js";
import RightClickMenus from "../../js/class/RightClickMenus.js";
import * as md from "../mdui.esm.js";
import Database from "../Database.js";
class NotificationDetail extends HTMLElement {
    /**
     * @type {HTMLDivElement}
     * @memberof NotificationDetail
     */
    #contentView;
    constructor() {
        super();
    }
    connectedCallback() {
        //root
        this.root = this.attachShadow({ mode: "open", delegatesFocus: true });
        //css
        const shadowStyle = document.createElement("link");
        shadowStyle.rel = "stylesheet";
        shadowStyle.href = "../css/shadow/notificationForwardPageShadow.css";
        this.root.appendChild(shadowStyle);
        const shadowStyleBase = document.createElement("link");
        shadowStyleBase.rel = "stylesheet";
        shadowStyleBase.href = "../css/shadow/baseStyleShadow.css";
        this.root.appendChild(shadowStyleBase);
        //所有属性值
        this.appIcon = this.getAttribute("app-icon");
        this.appName = this.getAttribute("app-name");
        this.notificationTitle = this.getAttribute("notification-title");
        this.notificationContent = this.getAttribute("notification-content");
        //外层卡片
        const rootCard = document.createElement("mdui-card");
        //clickable属性
        //虽然通常并不能点击 只是要那个hover效果
        rootCard.setAttribute("clickable", "");
        rootCard.classList.add("notificationItemFrame");
        //应用图标
        const icon = document.createElement("img");
        icon.classList.add("notificationApplicationIcon");
        this.onErrorListener = function () {
            //虽然不太可能 但万一啊 占位图片也加载失败了呢
            this.removeEventListener("error", this.onErrorListener);
            this.src = "../../res/app_icon_unknown.png"
        }
        icon.addEventListener("error", this.onErrorListener);
        icon.src = this.appIcon;
        //文本div
        const textDiv = document.createElement("div");
        textDiv.classList.add("notificationDetailTextDiv");
        //展开提示 默认隐藏
        this.spreadImage = document.createElement("mdui-button-icon");
        this.spreadImage.setAttribute("icon", "arrow_circle_down");
        //可选中
        this.spreadImage.setAttribute("selectable", "");
        this.spreadImage.style.display = "none";
        this.spreadImage.classList.add("spreadButton");
        this.spreadImage.addEventListener("click", () => {
            this.changeSpread();
        });
        textDiv.appendChild(this.spreadImage);
        //软件名
        const appName = document.createElement("small");
        appName.classList.add("notificationDetailTextMarginLeft");
        appName.innerText = this.appName;
        //标题
        const appTitle = document.createElement("b");
        appTitle.classList.add("notificationDetailTextMarginLeft");
        appTitle.innerText = this.notificationTitle;
        //内容
        const content = document.createElement("div");
        content.classList.add("notificationDetailTextMarginLeft", "notificationContent", "selectable");
        content.innerText = this.notificationContent;
        this.#contentView = content;
        //右键菜单
        rootCard.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            //根据是否有选择文本变化
            const menu = getSelection().toString() !== "" ? RightClickMenus.MENU_TRANSMIT_TEXT_SELECTED : RightClickMenus.MENU_NOTIFICATION_NOT_SELECTION;
            const result = await window.electronMainProcess.createRightClickMenu(menu);
            if (result === RightClickMenuItem.Null) return;
            switch (result) {
                case RightClickMenuItem.Copy:
                    navigator.clipboard.writeText(getSelection().toString());
                    break;
                case RightClickMenuItem.CopyContent:
                    navigator.clipboard.writeText(this.notificationContent);
                    break;
                case RightClickMenuItem.CopyTitle:
                    navigator.clipboard.writeText(this.notificationTitle);
                    break
                case RightClickMenuItem.Delete:
                    /**
                     * @type {number}
                     */
                    const timestamp = parseInt(this.getAttribute("notification-time"));
                    if (isNaN(timestamp)) {
                        // 删除失败 不知道会不会出现
                        md.snackbar({
                            message: "删除时发生异常:通知ID读取失败",
                            autoCloseDelay: 1250
                        });
                        return
                    }
                    Database.deleteData("notification",timestamp);
                    this.remove();
                    break
                case RightClickMenuItem.OpenNotificationApplicationPanel:
                    window.electronMainProcess.openNotificationForwardConfigWindow(this.getAttribute("notification-pkgName"),this.getAttribute("app-name"));
                    break
            }
        })
        //合并及打入
        textDiv.append(appName, appTitle, content);
        rootCard.appendChild(icon);
        rootCard.appendChild(textDiv);
        this.root.appendChild(rootCard);
    }
    requestSpread() {
        return this.#contentView.clientWidth < this.#contentView.scrollWidth - 10;
    }
    setSpread() {
        this.spreadImage.style.display = "inline-block"
    }
    changeSpread() {
        //未展开时
        if (this.#contentView.classList.contains("notificationContentSpread")) {
            //文本和箭头旋转
            this.#contentView.classList.remove("notificationContentSpread");
            this.spreadImage.classList.remove("spreadButtonRotate")
        } else {
            this.#contentView.classList.add("notificationContentSpread");
            this.spreadImage.classList.add("spreadButtonRotate")
        }
    }
}
export default NotificationDetail;