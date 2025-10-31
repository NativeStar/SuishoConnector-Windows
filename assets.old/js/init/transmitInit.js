import * as md from "../../modules/mdui.esm.js";
import Widget from "../../modules/Widgets.js";
import Util from "../../modules/Util.js";
import RightClickMenus from "../class/RightClickMenus.js";
import RightClickMenuItem from "../class/RightClickMenuItem.js";
import Database from "../../modules/Database.js";
class MessageTransmit {
    static #messageListElement = document.getElementById("messageList");
    static #transmitMessageList = [];
    static #messageFilterCardInput = document.getElementById("transmitMessageFilterInput");
    static #messageFilterCardCapsButton = document.getElementById("transmitMessageFilterCapsButton");
    /** @type {HTMLProgressElement} */
    static #fileProgressBarElement = null;
    static #progressingFileSize = 0;
    static async init() {
        this.#globalInit();
        //设置给全局变量
        const rawTransmitData = await Database.getAllData("transmit");
        // 解析数据并追加到缓存fragment
        const messageFragment = document.createDocumentFragment();
        for (const messageObject of rawTransmitData) {
            switch (messageObject.type) {
                case "text":
                    messageFragment.appendChild(Widget.transmitPlainTextView(messageObject.form === "phone" ? Widget.enum_TransmitMessageForm.MESSAGE_PHONE : Widget.enum_TransmitMessageForm.MESSAGE_COMPUTER, messageObject.message, messageObject.timestamp))
                    break;
                case "file":
                    messageFragment.appendChild(Widget.transmitFileView(messageObject.form === "phone" ? Widget.enum_TransmitMessageForm.MESSAGE_PHONE : Widget.enum_TransmitMessageForm.MESSAGE_COMPUTER, messageObject.displayName, messageObject.size, messageObject.isDeleted, messageObject.name, messageObject.timestamp))
                    break
                default:
                    break;
            }
        };
        //追加到列表
        this.#messageListElement.appendChild(messageFragment);
        //解析完成解除隐藏
        this.#messageListElement.hidden = false;
        // });
        //发送消息
        document.getElementById("transmit_action_send_button").addEventListener("click", () => {
            /** @type {String} */
            const inputValue = document.getElementById("transmit_text_input").value;
            //纯无输入过滤 不弹提示
            if (inputValue === "") return
            //空格过滤 带提示
            if (inputValue.replaceAll(" ", "") === "") {
                //提示并清空输入
                md.snackbar({
                    message: "无法发送空内容",
                    timeout: 1500
                });
                document.getElementById("transmit_text_input").value = "";
                return
            }
            //发送数据
            window.electronMainProcess.sendPacket({ packetType: "transmit_text", msg: inputValue });
            const sendTextTime = Date.now();
            let view = Widget.transmitPlainTextView(Widget.enum_TransmitMessageForm.MESSAGE_COMPUTER, inputValue, sendTextTime);
            this.#messageListElement.appendChild(view);
            this.scrollToNewView(view, false, true);
            const msgObject = { type: "text", message: inputValue, form: "computer", timestamp: sendTextTime };
            this.#transmitMessageList.push(msgObject);
            Database.addData("transmit", msgObject);
            //清空输入
            document.getElementById("transmit_text_input").value = "";
        });
        this.#messageListElement.addEventListener("dragenter", event => {
            // console.log(event.dataTransfer.types);
            //只接受计算机本地文件 长度判断是防止在浏览器里头拖个图片进来
            if (!event.dataTransfer.types.includes("Files") || event.dataTransfer.types.length !== 1) return
            document.getElementById("transmit_upload_file_hover_mask").hidden = false
        });
        //只允许文件拖动
        document.addEventListener("dragstart", event => {
            if (event.target.nodeName === "#text") event.preventDefault();
        });
        //只允许文件拖动
        document.addEventListener("dragstart", event => {
            if (event.target.nodeName === "#text")
                event.preventDefault();
        });
        //右键菜单
        this.#messageListElement.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            const result = await window.electronMainProcess.createRightClickMenu(RightClickMenus.MENU_TRANSMIT_NONE_ELEMENT);
            if (result === RightClickMenuItem.Null) return;
            //就一个选项 实在想不出来了
            if (result === RightClickMenuItem.Upload) {
                document.getElementById("hiddenUploadFileElement").click();
            }
        });
        this.#messageListElement.addEventListener("scrollend", () => {
            if (Math.abs(this.#messageListElement.scrollTop - (this.#messageListElement.scrollHeight - this.#messageListElement.clientHeight)) <= 25) {
                document.getElementById("transmitBadge").style.display = "none";
            }
        });
        //遮罩上事件 一旦显示下面的元素就无法获取事件了 要在这处理
        document.getElementById("transmit_upload_file_hover_mask").addEventListener("dragover", event => {
            event.preventDefault();
            document.getElementById("transmit_upload_file_hover_mask").hidden = false;
        });
        //修复卡控件边缘拖动卡死 有点问题+玄学玩意
        document.getElementById("transmit_upload_file_hover_mask").addEventListener("mouseover", () => {
            document.getElementById("transmit_upload_file_hover_mask").hidden = true;
        });
        document.getElementById("transmit_upload_file_hover_mask").addEventListener("dragleave", event => {
            document.getElementById("transmit_upload_file_hover_mask").hidden = true;
        });
        document.getElementById("transmit_upload_file_hover_mask").addEventListener("drop", event => {
            event.preventDefault();
            //隐藏遮罩
            document.getElementById("transmit_upload_file_hover_mask").hidden = true;
            //判断非文件或多文件
            if (event.dataTransfer.files.length === 0) {
                //如果来自自身就啥也不提示
                if (event.dataTransfer.getData("from_self") === "true") return
                md.snackbar({
                    message: "请拖入一个文件",
                    autoCloseDelay: 1200
                });
                return
            } else if (event.dataTransfer.files.length >= 2) {
                md.snackbar({
                    message: "暂时只支持单个文件上传",
                    autoCloseDelay: 1200
                });
                return
            }
            //判断文件夹
            if (event.dataTransfer.items[0].webkitGetAsEntry()?.isDirectory) {
                md.snackbar({
                    message: "不支持上传文件夹",
                    autoCloseDelay: 1200
                });
                return
            }
            this.addUploadingFileView(event.dataTransfer.files[0].name, window.electronMainProcess.getFilePath(event.dataTransfer.files[0]), event.dataTransfer.files[0].size);
        });
        //输入区阻止默认操作    
        document.getElementById("transmit_text_input").addEventListener("drop", event => {
            event.preventDefault();
            if (event.dataTransfer.files.length > 1) {
                md.snackbar({
                    message: "无法同时导入多个文件路径",
                    autoCloseDelay: 1200
                });
                return
            }
            document.getElementById("transmit_text_input").value += event.dataTransfer.files[0].path;
        })
        //快捷键
        document.getElementById("transmit_text_input").addEventListener("keydown", event => {
            if (event.ctrlKey && event.key === "Enter") {
                //直接向按钮发送点击事件
                document.getElementById("transmit_action_send_button").dispatchEvent(new MouseEvent("click"));
                //拉回焦点
                document.getElementById("transmit_text_input").focus();
            }
        });
        document.getElementById("menu_transmit_deleteTransmitMessages").addEventListener("click", () => {
            md.confirm({
                headline: "清空确认",
                description: "确认清空消息列表?\n接收的文件不会从硬盘中删除",
                confirmText: "确认",
                cancelText: "取消",
                onConfirm: () => {
                    //清空列表数组
                    this.#transmitMessageList = [];
                    Database.clearData("transmit");
                    //清空内容
                    this.#messageListElement.innerHTML = ''
                }
            });
        });
        //菜单2 在资源管理器打开互传接收文件夹
        document.getElementById("menu_transmit_openFilesFolder").addEventListener("click", () => {
            window.electronMainProcess.openInExplorer("transmitFolder")
        });
        //菜单3 上传文件
        document.getElementById("menu_transmit_uploadFile").addEventListener("click", () => document.getElementById("hiddenUploadFileElement").click());
        //菜单4 显示搜索框
        document.getElementById("menu_transmit_showFilterCard").addEventListener("click", () => {
            document.getElementById("transmitMessageFilterCard").style.display = "block";
            setTimeout(() => {
                this.#messageFilterCardInput.focus();
            }, 75);
        });
        //搜索框回车
        this.#messageFilterCardInput.addEventListener("keydown", event => {
            if (event.key === "Enter") this.#filterMessage(this.#messageFilterCardInput.value, this.#messageFilterCardCapsButton.selected);
        });
        //搜索框清空
        this.#messageFilterCardInput.addEventListener("clear", () => {
            this.#filterMessage("", false);
        });
        //搜索按钮
        document.getElementById("transmitMessageFilterSearchButton").addEventListener("click", () => this.#filterMessage(this.#messageFilterCardInput.value, this.#messageFilterCardCapsButton.selected));
        //搜索框关闭
        document.getElementById("transmitMessageFilterCloseButton").addEventListener("click", () => {
            document.getElementById("transmitMessageFilterInput").value = "";
            document.getElementById("transmitMessageFilterCard").style.display = "none";
        });
    }
    static requestFilterCard() {
        const searchCard = document.getElementById("transmitMessageFilterCard");
        searchCard.style.display = searchCard.style.display === "none" ? "block" : "none";
        if (searchCard.style.display === "block") this.#messageFilterCardInput.focus();
    }
    static #filterMessage(text="",caps=false){
        if (text==="") {
            //空搜索词 恢复显示
            for (const msgElement of this.#messageListElement.children) {
                msgElement.style.display = "";
            }
            return
        }
        for (const msgElement of this.#messageListElement.children) {
            //目前只有div和mdui-card两种元素 且div只可能是文本消息
            //够用了
            if (msgElement instanceof HTMLDivElement) {
                if ((caps ? msgElement.innerText : msgElement.innerText.toLowerCase()).includes(caps ? text : text.toLowerCase())) {
                    msgElement.style.display="";
                }else{
                    msgElement.style.display="none";
                }
            }else{
                const nameText=msgElement.getAttribute("fileName");
                if ((caps ? nameText : nameText.toLowerCase()).includes(caps ? text : text.toLowerCase())) {
                    msgElement.style.display="";
                }else{
                    msgElement.style.display="none";
                }
            }
        }
    }
    static #globalInit() {
        window.transmitScrollBottom = () => {
            this.scrollToBottom();
        }
        window.electronMainProcess.fileUploadProgress((_electronEvent, progress) => {
            //进度条
            this.#fileProgressBarElement.setAttribute("value", progress / this.#progressingFileSize);
        });
    }
    /**
    * @description 滚动到指定元素 只有离底部较近才滚动
    * @param {HTMLElement} element 
    * @param {boolean} [force=false] 强制滚动
    */
    static scrollToNewView(element, force = false, fromSelf = false) {
        //处理强制滚动
        if (force) {
            element.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" })
            return
        }
        //除非离底部小于480 才滚动
        if (Math.abs(this.#messageListElement.scrollTop - (this.#messageListElement.scrollHeight - this.#messageListElement.clientHeight)) <= 480) {
            element.scrollIntoView({ behavior: "smooth", block: "end", inline: "end" })
        } else if (!fromSelf) {
            document.getElementById("transmitBadge").style.display = "block";
        }
    }
    /**
     * 
     * @param {number} timestamp 
     */
    static getMessageObject(timestamp) {
        return this.#transmitMessageList.find((value, index, obj) => {
            return value.timestamp === timestamp;
        })
    }
    static removeMessage(timestamp) {
        this.#transmitMessageList.forEach((value, index, obj) => {
            if (value.timestamp === timestamp) {
                this.#transmitMessageList.splice(index, 1);
            }
        });
        Database.deleteData("transmit", timestamp);
    }
    /**
    * @description 互传上传文件
    * @param {String} name
    * @param {String} path
    * @param {number} size 
    */
    static addUploadingFileView(name, path, size) {
        //判断任务
        if (this.#fileProgressBarElement !== null) {
            md.snackbar({
                message: "请等待上一个上传任务完成",
                autoCloseDelay: 1500
            })
            return
        }
        //新建view
        let view = Widget.transmitFileView_uploading(Widget.enum_TransmitMessageForm.MESSAGE_COMPUTER, name, size, "", Date.now());
        this.#messageListElement.appendChild(view);
        this.scrollToNewView(view);
        this.#fileProgressBarElement = view.getElementsByClassName("transmit_file_upload_progressBar")[0];
        this.#progressingFileSize = size;
        //开始上传
        window.electronMainProcess.transmitUploadFile(name, path, size)
    }
    /**
     * 追加纯文本
     * @param {string} text 
     */
    static appendPlainText(text) {
        const time = Date.now();
        const newView = Widget.transmitPlainTextView(Widget.enum_TransmitMessageForm.MESSAGE_PHONE, text, time);
        this.#messageListElement.appendChild(newView);
        this.scrollToNewView(newView);
        const msgObject = {
            type: "text",
            message: text,
            form: "phone",
            timestamp: time
        }
        this.#transmitMessageList.push(msgObject);
        Database.addData("transmit", msgObject)
    }
    /**
     * 
     * @param {string} name 文件显示名 
     * @param {number} size 文件大小
     * @param {string} realName 真实文件名 应对文件名重复 
     */
    static appendFile(name, size, realName) {
        const fileView = Widget.transmitFileView_uploading(Widget.enum_TransmitMessageForm.MESSAGE_PHONE, name, size, realName, Date.now());
        this.#messageListElement.appendChild(fileView);
        this.scrollToNewView(fileView);
        this.#fileProgressBarElement = fileView.getElementsByClassName("transmit_file_upload_progressBar")[0];
        //标记来源
        this.#fileProgressBarElement.fileFrom = Widget.enum_TransmitMessageForm.MESSAGE_PHONE;
        this.#progressingFileSize = size;
    }
    static onFileUploadSuccess(name, displayName, from) {
        this.#fileProgressBarElement.value = 1;
        this.#fileProgressBarElement.classList.add("hideProgressClass");
        //移除文件大小文字颜色
        this.#fileProgressBarElement.parentElement.getElementsByClassName("color_GREEN")[0].classList.remove("color_GREEN");
        //是否来自手机
        if (this.#fileProgressBarElement.parentElement.classList.contains("messageTransmit_text_formPhone")) {
            //可拖拽标记
            this.#fileProgressBarElement.parentElement.setAttribute("draggable", "true");
            //标为可拖拽类 不阻止事件
            this.#fileProgressBarElement.parentElement.classList.add("draggable");
            //hover效果
            this.#fileProgressBarElement.parentElement.setAttribute("clickable", "");
        };
        const fileUploadTime = parseInt(this.#fileProgressBarElement.parentElement.getAttribute("timestamp"));
        const fileMsgObject = {
            type: "file",
            name: name,
            displayName: displayName,
            size: this.#progressingFileSize,
            form: from === 0 ? "phone" : "computer",
            isDeleted: false,
            timestamp: fileUploadTime
        };
        this.#transmitMessageList.push(fileMsgObject);
        Database.putData("transmit", fileMsgObject);
        this.#fileProgressBarElement.parentElement.scrollIntoView({ behavior: "smooth", block: "end", inline: 'nearest' });
        //清空临时变量
        this.#fileProgressBarElement = null;
        this.#progressingFileSize = null;
    }
    static onFileUploadFailed(reasonTitle, reasonText) {
        md.alert({
            headline: reasonTitle,
            description: reasonText,
            confirmText: "确定",
            onConfirm: () => { },
        });
        this.#messageListElement.removeChild(this.#fileProgressBarElement.parentElement);
        this.#fileProgressBarElement = null;
        this.#progressingFileSize = null;
    }
    static scrollToBottom() {
        this.#messageListElement.scrollTo(0, document.getElementById("messageList").scrollHeight + 500)
    }
}
export default MessageTransmit;