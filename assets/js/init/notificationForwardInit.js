// import Database from "../../modules/Database.js";
import * as md from "../../modules/mdui.esm.js";
import Database from "../../modules/Database.js";
class NotificationForwardInit {
    // static configWindow = null;
    static deviceDataPath = "";
    /**
     * 通知列表元素
     * @type {HTMLDivElement}
     */
    static #notificationsList = document.getElementById("forwardedNotificationsList");;
    /**
     * @description 页面首次点击初始化
     * @static
     * @memberof NotificationForwardInit
     */
    static onPageSelect() {

    }
    /**
     * 深度隐藏通知map
     * @type {Map<string,boolean>}
     * @static
     * @memberof NotificationForwardInit
     */
    static notificationHiddenMap = new Map();
    /**
     * 是否显示隐藏通知
     * @static
     * @memberof NotificationForwardInit
     */
    static showDeepHideNotification = false;
    static #filterCardInput = document.getElementById("notificationForwardFilterInput");
    static #filterCardCapsButton = document.getElementById("notificationForwardFilterCapsButton");
    static #filterCardIncludeAppNameButton = document.getElementById("notificationForwardFilterIncludeApplicationNameButton");
    /**
     * @description 页面加载完成
     * @static
     * @memberof NotificationForwardInit
     */
    static async onAppLoaded() {
        //保护
        window.electronMainProcess.getDeviceConfig("protectNotificationForwardPage").then(value => {
            if (value) {
                for (const item of document.getElementsByClassName("notificationProtectDisable")) {
                    //停用
                    item.setAttribute("disabled", "");
                }
                //遮罩
                document.getElementById("notificationProtectMask").hidden = false;
                //验证按钮
                document.getElementById("notificationForwardVerifyButtonIcon").setAttribute("name", "lock_open")
            } else {
                document.getElementById("notificationForwardVerifyButtonIcon").setAttribute("name", "lock");
                document.getElementById("notificationForwardVerifyTip").setAttribute("content", "锁定");
            }
        });
        (async () => {
            this.deviceDataPath = await window.electronMainProcess.getDeviceDataPath();
            const notificationDataList = await Database.getAllData("notification");
            const protectNotificationForwardPage = await window.electronMainProcess.getDeviceConfig("protectNotificationForwardPage");
            if (notificationDataList.length !== 0) {
                //初始化显示通知
                for (const dataObj of notificationDataList) {
                    const element = document.createElement("suisho-notification-detail");
                    //node层获取绝对路径
                    element.setAttribute("app-icon", `${this.deviceDataPath}assets/iconCache/${dataObj.packageName}`);
                    //通过专门包管理器获取 占位为包名
                    element.setAttribute("app-name", dataObj.appName);
                    element.setAttribute("notification-title", dataObj.title);
                    element.setAttribute("notification-content", dataObj.content);
                    element.setAttribute("notification-time", dataObj.timestamp);
                    element.setAttribute("notification-pkgName", dataObj.packageName);
                    //隐藏通知
                    if (protectNotificationForwardPage && await this.#needHideNotification(dataObj.packageName)) {
                        element.hidden = true;
                    }
                    this.#notificationsList.appendChild(element);
                }
            }
        })();
        //通知搜索面板控制
        document.getElementById("notificationForwardSearchButton").addEventListener("click", () => {
            const searchCard = document.getElementById("notificationForwardSearchCard");
            searchCard.style.display = searchCard.style.display === "none" ? "block" : "none";
            setTimeout(() => {
                if (searchCard.style.display === "block") this.#filterCardInput.focus();
            }, 75);
        });
        //清空搜索词
        this.#filterCardInput.addEventListener("clear", async () => {
            for (const item of document.getElementById("forwardedNotificationsList").children) {
                //修复清空搜索后隐藏内容全部被显示
                if (this.showDeepHideNotification) {
                    item.removeAttribute("hidden");
                } else {
                    if (!await this.#needHideNotification(item.getAttribute("notification-pkgName"))) item.removeAttribute("hidden");
                }
            }
        })
        //通知搜索功能
        this.#filterCardInput.addEventListener("keyup", async (event) => {
            if (event.key === "Enter") {
                this.#filterNotification(this.#filterCardInput.value, this.#filterCardCapsButton.selected)
            }
        });
        //关闭搜索框按钮
        document.getElementById("notificationForwardFilterCloseButton").addEventListener("click",()=>{
            document.getElementById("notificationForwardSearchCard").style.display="none"
        })
        //过滤设置
        document.getElementById("notificationForwardFilterButton").addEventListener("click", (event) => {
            window.electronMainProcess.openNotificationForwardConfigWindow();
            //修复打开窗口后tooltip不消失
            event.target.blur();
        });
        document.getElementById("notificationForwardClearButton").addEventListener("click", async (event) => {
            md.confirm({
                headline: "清空通知记录",
                description: "确认清空通知记录?",
                confirmText: "确认",
                cancelText: "取消",
                onConfirm: async () => {
                    await Database.clearData("notification")
                    document.getElementById("forwardedNotificationsList").innerHTML = "";
                    md.snackbar({
                        message: "删除成功",
                        autoCloseDelay: 1000
                    });
                }
            });
        });
        //验证或上锁按钮
        document.getElementById("notificationForwardVerifyButton").addEventListener("mousedown", async (event) => {
            //只接受左右键
            if (event.button !== 0 && event.button !== 2) {
                return
            };
            const protectNotificationForwardPage = await window.electronMainProcess.getDeviceConfig("protectNotificationForwardPage");
            if (!protectNotificationForwardPage && event.button === 2) {
                const notifications = this.#notificationsList.children;
                for (const element of notifications) {
                    element.hidden = false
                }
                return
            }
            //显示隐藏通知
            this.showDeepHideNotification = event.button === 2;
            event.target.blur();
            if (!document.getElementById("notificationProtectMask").hidden) {
                //解锁
                const protectMethod = await window.electronMainProcess.getDeviceConfig("protectMethod");
                if (protectMethod === "oauth") {
                    if (!await window.electronMainProcess.startAuthorization()) {
                        md.snackbar({
                            message: "验证失败",
                            autoCloseDelay: 1250
                        });
                        return
                    }
                } else if (protectMethod === "password") {
                    if (!await this.#verifyPassword("输入密码以查看")) {
                        md.snackbar({
                            message: "验证失败",
                            autoCloseDelay: 1250
                        });
                        return
                    }
                } else if (protectMethod === "none" || protectMethod === null) {
                    //好像没什么意义
                } else {
                    return
                }
                document.getElementById("notificationForwardVerifyButtonIcon").setAttribute("name", "lock");
                document.getElementById("notificationForwardVerifyTip").setAttribute("content", "锁定");
                for (const item of document.getElementsByClassName("notificationProtectDisable")) {
                    //恢复
                    item.removeAttribute("disabled");
                }
                //是否显示隐藏的通知
                const notifications = this.#notificationsList.children;
                if (this.showDeepHideNotification) {
                    //全部显示
                    for (const element of notifications) {
                        element.hidden = false
                    }
                    //滚动到底部 不然先不显示隐藏再切换为显示时位置会异常
                    this.#notificationsList.scrollTo(0, this.#notificationsList.scrollHeight + 500);
                } else {
                    //隐藏deepHide
                    for (const element of notifications) {
                        element.hidden = await this.#needHideNotification(element.getAttribute("notification-pkgName"));
                    }
                }
                //遮罩
                document.getElementById("notificationProtectMask").hidden = true;
                md.snackbar({
                    message: "已解锁",
                    autoCloseDelay: 1000
                });
            } else {
                //上锁 需要开启保护
                //如果未开启保护且是右键点击 不弹出提示
                if (!await window.electronMainProcess.getDeviceConfig("protectNotificationForwardPage") && event.button === 0) {
                    md.snackbar({
                        message: "未开启保护",
                        autoCloseDelay: 1000
                    });
                    return
                }
                //解锁
                document.getElementById("notificationForwardVerifyButtonIcon").setAttribute("name", "lock_open");
                document.getElementById("notificationForwardVerifyTip").setAttribute("content", "解锁");
                for (const item of document.getElementsByClassName("notificationProtectDisable")) {
                    //停用
                    item.setAttribute("disabled", "");
                }
                //关闭搜索框
                this.#filterCardInput.blur();
                this.#filterCardInput.value = "";
                document.getElementById("notificationForwardSearchCard").style.display = "none";
                //遮罩
                document.getElementById("notificationProtectMask").hidden = false;
                //清空搜索内容
                this.#filterNotification("",false);
            }
        });
        //未读通知徽章取消
        this.#notificationsList.addEventListener("scrollend", () => {
            if (Math.abs(this.#notificationsList.scrollTop - (this.#notificationsList.scrollHeight - this.#notificationsList.clientHeight)) <= 25) {
                document.getElementById("notificationForwardBadge").style.display = "none";
            }
        })
    }
    static requestFilterCard() {
        const protectMark=document.getElementById("notificationProtectMask")
        if(!protectMark.hidden) return;
        const searchCard = document.getElementById("notificationForwardSearchCard");
        searchCard.style.display = searchCard.style.display === "none" ? "block" : "none";
        if (searchCard.style.display === "block") this.#filterCardInput.focus();
    }
    static init() {
        //滚到底部
        this.#notificationsList.scrollTo(0, this.#notificationsList.scrollHeight + 500);
        //通知内容展开
        for (const item of document.getElementById("forwardedNotificationsList").children) {
            //需要时加上展开按钮
            if (item.requestSpread()) {
                item.setSpread();
            }
        }
    }    /**
     * @description 切换通知列表长度
     * @static
     * @memberof NI
     */
    static changeNotificationListState() {
        const element = document.getElementById("forwardedNotificationsList");
        const classes = element.classList;
        //短
        if (classes.contains("forwardedNotificationsListLong")) {
            classes.remove("forwardedNotificationsListLong");
            classes.add("forwardedNotificationsListShort");
        } else {//长
            classes.add("forwardedNotificationsListLong");
            classes.remove("forwardedNotificationsListShort");
        }
    }
    /**
     * @param {string} packageName 
     * @param {string} appName 
     * @param {string} title 
     * @param {string} content 
     * @param {number} time 
     */
    static async appendNotification(packageName, appName, title, content, time) {
        Database.addData("notification", { timestamp: time, packageName: packageName, title: title, content: content, appName: appName });
        //加入dom
        const element = document.createElement("suisho-notification-detail");
        element.setAttribute("app-icon", `${this.deviceDataPath}assets/iconCache/${packageName}`);
        element.setAttribute("app-name", appName);
        element.setAttribute("notification-title", title);
        element.setAttribute("notification-content", content);
        element.setAttribute("notification-time", time);
        element.setAttribute("notification-pkgName", packageName);
        //处理隐藏通知
        if (!this.showDeepHideNotification) {
            element.hidden = await this.#needHideNotification(packageName);
        }
        this.#notificationsList.appendChild(element);
        setTimeout(() => {
            if (element.requestSpread()) {
                element.setSpread();
            }
        }, 500);
        //自动滚动
        if (Math.abs(this.#notificationsList.scrollTop - (this.#notificationsList.scrollHeight - this.#notificationsList.clientHeight)) <= 160 && document.getElementById("rail_notification_forward_button").hasAttribute("active")) {
            element.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" })
        } else if (this.#notificationsList.scrollHeight !== this.#notificationsList.clientHeight) {
            document.getElementById("notificationForwardBadge").style.display = "block";
        }
    }
    static async #filterNotification(text = "", caps = false) {
        const targetText = caps ? text : text.toLowerCase();
        /**
         * @type {Set<HTMLElement>}
         */
        const tmp = new Set();
        const protectNotificationForwardPage = await window.electronMainProcess.getDeviceConfig("protectNotificationForwardPage");
        //搜索遍历
        for (const notify of this.#notificationsList.children) {
            //内容搜索
            //避免搜索需要隐藏的通知
            if (protectNotificationForwardPage&&!this.showDeepHideNotification && await this.#needHideNotification(notify.getAttribute("notification-pkgName"))) {
                continue;
            }
            // const title = notify.getAttribute("notification-title").toLowerCase();
            const title = caps ? notify.getAttribute("notification-title") : notify.getAttribute("notification-title").toLowerCase();
            // const content = notify.getAttribute("notification-content").toLowerCase();
            const content = caps ? notify.getAttribute("notification-content") : notify.getAttribute("notification-content").toLowerCase();
            if (title.includes(targetText) || content.includes(targetText)) {
                tmp.add(notify);
            }
            //应用名
            if (this.#filterCardIncludeAppNameButton.selected) {
                const appName = notify.getAttribute("app-name");
                if ((caps ? appName : appName.toLowerCase()).includes(targetText)) tmp.add(notify);
            }
        }
        //根据set设置元素可见性
        for (const item of this.#notificationsList.children) {
            if (tmp.has(item)) {
                item.removeAttribute("hidden");
            } else {
                item.setAttribute("hidden", "");
            }
        }
    }
    static #verifyPassword(desc) {
        return new Promise((resolve, reject) => {
            md.prompt({
                headline: "输入密码",
                description: desc,
                confirmText: "确定",
                cancelText: "取消",
                textFieldOptions: {
                    type: "password"
                },
                /**
                 * @param {string} value 
                 */
                onConfirm: (value) => {
                    const input = value.toString();
                    //空输入
                    if (input.replaceAll(" ", "") === "") {
                        resolve(false);
                        return
                    }
                    const targetHash = localStorage.getItem(`pwdHash_${window.deviceAndroidId}`);
                    resolve(sha256(input) === targetHash);
                },
                onCancel: () => {
                    resolve(false);
                }
                //库本身有bug
            }).catch(() => { });
        });
    }
    /**
     * 是否需要在列表隐藏该应用的通知
     * @param {string} pkgName 
     * @returns {Promise<boolean>}
     */
    static async #needHideNotification(pkgName) {
        //已有缓存
        if (this.notificationHiddenMap.has(pkgName)) {
            return this.notificationHiddenMap.get(pkgName);
        }
        //未缓存 拉取
        const profile = await window.electronMainProcess.getNotificationProfile(pkgName);
        //异常情况
        if (profile == null) return false;
        this.notificationHiddenMap.set(pkgName, profile.enableDeepHidden);
        return profile.enableDeepHidden;
    }
}
export default NotificationForwardInit;