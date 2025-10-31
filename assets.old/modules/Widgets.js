import Util from "./Util.js";
import RightClickMenus from "../js/class/RightClickMenus.js";
import MessageTransmit from "../js/init/transmitInit.js";
import RightClickMenuItem from "../js/class/RightClickMenuItem.js";
import Database from "./Database.js";
class widgets {
    /**
     * @static
     * @memberof widgets
     */
    //消息来源枚举
    static enum_TransmitMessageForm = {
        MESSAGE_PHONE: 0,
        MESSAGE_COMPUTER: 1
    }
    //url判定
    static urlRegexp = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\*\+,;=.]+$/;
    /**
     * @static
     * @param {number} [messageForm=0]
     * @param {string} [text=""]
     * @param {number} timestamp
     * @return {HTMLDivElement} 
     * @memberof widgets
     */
    static transmitPlainTextView(messageForm = 0, text = "", timestamp) {
        // 未来加上链接识别
        const baseElement = document.createElement("div");
        baseElement.classList.add("messageTransmit_text_baseStyles", "selectable", "mdui-theme-auto");
        if (messageForm === this.enum_TransmitMessageForm.MESSAGE_PHONE) {
            baseElement.classList.add("messageTransmit_text_formPhone");
        } else if (messageForm === this.enum_TransmitMessageForm.MESSAGE_COMPUTER) {/* 以防万一 加多个if */
            baseElement.classList.add("messageTransmit_text_formComputer");
        }
        baseElement.setAttribute("timestamp", timestamp);
        baseElement.innerText = text;
        baseElement.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            let menu;
            //是否选中文本
            if (getSelection().toString() === "") {
                //判断是否存在url
                if (this.urlRegexp.test(text)) {
                    menu = RightClickMenus.MENU_TRANSMIT_TEXT_HAS_URL;
                } else {
                    menu = RightClickMenus.MENU_TRANSMIT_TEXT;
                }
            } else {
                //有选中
                if (this.urlRegexp.test(getSelection().toString())) {
                    menu = RightClickMenus.MENU_TRANSMIT_URL_SELECTED;
                } else {
                    menu = RightClickMenus.MENU_TRANSMIT_TEXT_SELECTED;
                }
            }
            const result = await window.electronMainProcess.createRightClickMenu(menu);
            //取消弹窗
            if (result === RightClickMenuItem.Null) return
            switch (result) {
                case RightClickMenuItem.Copy:
                    if (getSelection().toString() === "") {
                        //全部复制
                        navigator.clipboard.writeText(text);
                    } else {
                        //复制选中
                        navigator.clipboard.writeText(getSelection().toString());
                    }
                    break;
                case RightClickMenuItem.Delete:
                    //标记为删除
                    Database.deleteData("transmit", timestamp)
                    MessageTransmit.removeMessage(timestamp);
                    baseElement.remove();
                    break
                case RightClickMenuItem.OpenUrl:
                    //打开url
                    window.electronMainProcess.openUrl(text.toLowerCase().startsWith("https://") ? text : `https://${text}`);
                    break
                case RightClickMenuItem.OpenSelectedUrl:
                    window.electronMainProcess.openUrl(getSelection().toString().toLowerCase().startsWith("https://") ? getSelection().toString() : `https://${getSelection().toString()}`);
                default:
                    console.warn(`Unknown right click menu item id:${result}`);
                    break;
            }
        })
        return baseElement
    }
    // 文件view
    /**
     * @description 创建互传界面上传完成的文件标签
     * @static
     * @param {0|1} form
     * @param {string} [name="UNDEFINED"] 文件显示名称 防止实际文件重名覆盖的设计
     * @param {number} [size=0]
     * @param {boolean} [deleted=false]
     * @param {String|null} [realName=null] 文件保存的真正名称
     * @return {HTMLDivElement} 
     * @param {number} timestamp 
     * @memberof widgets
     */
    static transmitFileView(form, name = "UNDEFINED", size = 0, deleted = false, realName = null, timestamp) {
        let filePath;
        const baseElement = document.createElement("mdui-card");
        baseElement.setAttribute("fileName",name);
        baseElement.classList.add("mdui-theme-auto");
        baseElement.setAttribute("variant", "elevated");
        baseElement.classList.add("messageTransmit_file_baseStyle", "draggable");
        form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER ? baseElement.classList.add("messageTransmit_text_formComputer") : baseElement.classList.add("messageTransmit_text_formPhone");
        //阻止来自自身的元素被拖拽
        if (form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER) {
            //删除拖拽class
            baseElement.classList.remove("draggable");
        }
        const fileIconElement = document.createElement("img");
        fileIconElement.src = "../bitmaps/transmit_file_default.png";
        fileIconElement.classList.add("messageTransmit_file_icon");
        const fileName = document.createElement("b");
        fileName.classList.add("transmit_file_name");
        fileName.innerText = name;
        const fileSize = document.createElement("a");
        fileSize.innerText = deleted ? "文件被删除" : Util.parseFileSize(size);
        if (deleted) {
            //删除拖拽class
            baseElement.classList.remove("draggable");
            fileSize.classList.add("color_RED");
        } else
            fileSize.classList.add("transmit_file_size");
        baseElement.setAttribute("timestamp", timestamp);
        baseElement.append(fileIconElement, fileName, document.createElement("br"), fileSize);
        //hover效果
        if (!deleted && form === this.enum_TransmitMessageForm.MESSAGE_PHONE) {
            baseElement.setAttribute("clickable", "");
        }
        baseElement.addEventListener("click", async () => {
            //被删除或来自电脑
            if (deleted || form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER) {
                return
            }
            if (!await window.electronMainProcess.openFile(realName)) {
                let sizeText = baseElement.getElementsByClassName("transmit_file_size")[0];
                sizeText.innerText = "无法打开:文件已被删除";
                //将文件大小文本改为红色
                sizeText.classList.add("color_RED");
                //更改存储内容
                (async () => {
                    const originData = await Database.getData("transmit", timestamp);
                    if (!originData.isDeleted) {
                        originData.isDeleted = true;
                        Database.putData("transmit", originData);
                    }
                })();
            }
        });
        baseElement.setAttribute("draggable", "true");
        //拖拽事件
        (async () => {
            //阻止被删除文件导出
            if (deleted) {
                return
            }
            filePath = await window.electronMainProcess.generateTransmitFileURL(realName);
            baseElement.addEventListener("dragstart", (event) => {
                if (form === this.enum_TransmitMessageForm.MESSAGE_PHONE) event.dataTransfer.setData("DownloadURL", `application/x-www-form-urlencoded:${name}:${filePath}`);
                //标记来自自身 阻止一些事件
                event.dataTransfer.setData("from_self", "true");
            });
        })();
        //右键
        baseElement.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            //菜单
            //*clone一份避免后面针对单个文件的菜单修改变成全局的
            const menu = structuredClone(RightClickMenus.MENU_TRANSMIT_FILE);
            //被删除和电脑发送的文件不允许在资源管理器中打开
            if (deleted || form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER) menu[0].enabled = false;
            const result = await window.electronMainProcess.createRightClickMenu(menu);
            if (result === RightClickMenuItem.Null) return
            switch (result) {
                case RightClickMenuItem.OpenInExplorer:
                    const fileExist = await window.electronMainProcess.openInExplorer("transmitFile", realName);
                    //文件已被删除
                    if (!fileExist) {
                        let sizeText = baseElement.getElementsByClassName("transmit_file_size")[0];
                        sizeText.innerText = "无法打开:文件已被删除";
                        //将文件大小文本改为红色
                        sizeText.classList.add("color_RED");
                        //更改存储内容
                        (async () => {
                            const data = await Database.getData("transmit", timestamp);
                            if (!data.isDeleted) {
                                data.isDeleted = true;
                                Database.putData("transmit", data);
                            }
                        })();
                    }
                    break;
                case RightClickMenuItem.Delete:
                    Database.deleteData("transmit", timestamp)
                    MessageTransmit.removeMessage(timestamp);
                    baseElement.remove();
                    break
                default:
                    console.warn(`Unknown right click menu item id:${result}`);
            }
        });
        return baseElement;
    }
    static transmitFileView_uploading(form, name = "UNDEFINED", size = 0, realName, timestamp) {
        let filePath;
        const baseElement = document.createElement("mdui-card");
        baseElement.setAttribute("fileName",name);
        baseElement.classList.add("messageTransmit_file_baseStyle");
        baseElement.classList.add("mdui-theme-auto");
        form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER ? baseElement.classList.add("messageTransmit_text_formComputer") : baseElement.classList.add("messageTransmit_text_formPhone")
        const fileIconElement = document.createElement("img");
        fileIconElement.src = "../bitmaps/transmit_file_default.png";
        fileIconElement.classList.add("messageTransmit_file_icon");
        const fileName = document.createElement("b");
        fileName.classList.add("transmit_file_name");
        fileName.innerText = name;
        const fileSize = document.createElement("a");
        fileSize.innerText = Util.parseFileSize(size);
        fileSize.classList.add("color_GREEN", "transmit_file_size");
        baseElement.setAttribute("timestamp", timestamp);
        const progressBar = document.createElement("mdui-linear-progress");
        progressBar.setAttribute("value", 0);
        progressBar.classList.add("transmit_file_upload_progressBar");
        baseElement.addEventListener("click", async () => {
            //pc上传不能打开
            if (form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER) return
            //未完成不予执行
            if (!baseElement.hasAttribute("draggable")) return
            if (!await window.electronMainProcess.openFile(realName)) {
                let sizeText = baseElement.getElementsByClassName("transmit_file_size")[0];
                sizeText.innerText = "文件被删除";
                //将文件大小文本改为红色
                sizeText.classList.add("color_RED");
                (async () => {
                    const data = await Database.getData("transmit", timestamp);
                    if (!data.isDeleted) {
                        data.isDeleted = true;
                        Database.putData("transmit", data);
                    }
                })();
            }
        });
        (async () => {
            filePath = await window.electronMainProcess.generateTransmitFileURL(realName);
            baseElement.addEventListener("dragstart", (event) => {
                event.dataTransfer.setData("from_self", "true");
                //只给手机上传的文件加上文件链接
                if (form === this.enum_TransmitMessageForm.MESSAGE_PHONE) event.dataTransfer.setData("DownloadURL", `application/x-www-form-urlencoded:${name}:${filePath}`);
            });
        })();
        baseElement.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            //以进度条是否可见为标记
            if (!progressBar.classList.contains("hideProgressClass")) return
            const menu = structuredClone(RightClickMenus.MENU_TRANSMIT_FILE);
            //是否允许再资源管理器打开
            if (form === this.enum_TransmitMessageForm.MESSAGE_COMPUTER) menu[0].enabled = false;
            const result = await window.electronMainProcess.createRightClickMenu(menu);
            if (result === RightClickMenuItem.Null) return
            switch (result) {
                case RightClickMenuItem.OpenInExplorer:
                    const fileExist = await window.electronMainProcess.openInExplorer("transmitFile", realName);
                    //文件已被删除
                    if (!fileExist) {
                        let sizeText = baseElement.getElementsByClassName("transmit_file_size")[0];
                        sizeText.innerText = "无法打开:文件已被删除";
                        //将文件大小文本改为红色
                        sizeText.classList.add("color_RED");
                        //更改存储内容
                        (async () => {
                            const data = await Database.getData("transmit", timestamp);
                            if (!data.isDeleted) {
                                data.isDeleted = true;
                                Database.putData("transmit", data);
                            }
                        })();
                    }
                    break;
                case RightClickMenuItem.Delete:
                    Database.deleteData("transmit", timestamp)
                    MessageTransmit.removeMessage(timestamp);
                    baseElement.remove();
                    break
                default:
                    console.warn(`Unknown right click menu item id:${result}`);
            }
        })
        baseElement.append(fileIconElement, fileName, document.createElement("br"), fileSize, progressBar);
        return baseElement;
    }
}
export default widgets