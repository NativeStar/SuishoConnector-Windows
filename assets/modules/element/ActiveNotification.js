class ActiveNotification extends HTMLElement {
    /**
     * @type {HTMLDivElement}
     * @memberof NotificationDetail
     */
    #contentView;
    #dataPath;
    #pkgName;
    #ongoing;
    constructor(dataPath,pkgName,ongoing) {
        super();
        this.#dataPath = dataPath;
        this.#pkgName = pkgName;
        this.#ongoing = ongoing;
    }
    connectedCallback() {
        this.root = this.attachShadow({ mode: "open" });
        //css
        const shadowStyle = document.createElement("link");
        shadowStyle.rel = "stylesheet";
        shadowStyle.href = "../css/shadow/activeNotificationShadow.css";
        const shadowStyleBase = document.createElement("link");
        shadowStyleBase.rel = "stylesheet";
        shadowStyleBase.href = "../css/shadow/baseStyleShadow.css";
        this.root.append(shadowStyleBase,shadowStyle);
        //所有属性值
        this.appIcon = this.getAttribute("app-icon");
        this.appName = this.getAttribute("app-name");
        this.notificationTitle = this.getAttribute("notification-title");
        this.notificationContent = this.getAttribute("notification-content");
        this.notificationKey = this.getAttribute("notification-key");
        //外层卡片
        const rootCard = document.createElement("mdui-card");
        rootCard.classList.add("notificationItemFrame");
        //应用图标
        const icon = document.createElement("img");
        icon.classList.add("notificationApplicationIcon");
        icon.src=`${this.#dataPath}assets/iconCache/${this.#pkgName}`
        //展开提示 默认隐藏
        this.spreadIcon = document.createElement("mdui-icon");
        this.spreadIcon.setAttribute("name", "keyboard_arrow_down");
        //可选中
        // this.spreadImage.setAttribute("selectable", "");
        this.spreadIcon.style.display = "none";
        this.spreadIcon.classList.add("spreadButton");
        this.spreadIcon.addEventListener("click",()=>{
            this.changeSpread();
        });
        if (this.#ongoing) {
            this.spreadIcon.classList.add("spreadButtonOngoing")
        }
        //移除通知按钮
        const removeButton = document.createElement("mdui-icon");
        removeButton.setAttribute("name","close");
        removeButton.classList.add("removeNotificationButton");
        removeButton.addEventListener("click",()=>{
            //移除通知包
            const removeNotificationPacket={
                packetType:"removeCurrentNotification",
                key:this.notificationKey
            }
            window.electronMainProcess.sendPacket(removeNotificationPacket)
            this.remove();
        });
        if (this.#ongoing) {
            //隐藏移除通知按钮
            removeButton.style.display="none";
        }
        //文本div
        const textDiv = document.createElement("div");
        textDiv.classList.add("notificationDetailTextDiv");
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
        content.classList.add("notificationDetailTextMarginLeft", "notificationContent");
        content.innerText = this.notificationContent;
        this.#contentView = content;
        textDiv.append(appName, appTitle, content);
        rootCard.append(icon, textDiv,this.spreadIcon,removeButton);
        this.root.append(rootCard);
    }
    requestSpread() {
        return this.#contentView.clientWidth < this.#contentView.scrollWidth - 10;
    }
    setSpread() {
        this.spreadIcon.style.display = "inline-block"
    }
    changeSpread() {
        //未展开时
        if (this.#contentView.classList.contains("notificationContentSpread")) {
            //文本和箭头旋转
            this.#contentView.classList.remove("notificationContentSpread");
            this.spreadIcon.setAttribute("name", "keyboard_arrow_down")
        } else {
            this.#contentView.classList.add("notificationContentSpread");
            this.spreadIcon.setAttribute("name", "keyboard_arrow_up")
        }
    }
}
export default ActiveNotification;