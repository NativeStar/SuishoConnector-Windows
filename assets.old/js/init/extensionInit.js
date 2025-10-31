import * as md from "../../modules/mdui.esm.js";
class ExtensionInit {
    static async init() {
        //点击列表元素更改开关
        for (const element of document.getElementsByClassName("extensionSwitchItemElement")) {
            element.children[0].addEventListener("change", () => {
                window.electronMainProcess.setConfig(element.children[0].getAttribute("config"), element.children[0].checked);
            });
            element.addEventListener("click", () => {
                element.children[0].click();
            });
        }
        this.#notificationProcessorInit();
    }
    static async #notificationProcessorInit() {
        const isEnabled = await window.electronMainProcess.getConfig("extension_notificationProcessorEnable");
        const port = await window.electronMainProcess.getConfig("extension_notificationProcessorPort");
        const allowCancelShow = await window.electronMainProcess.getConfig("extension_notificationProcessorAllowCancelNotificationShow");
        const token = await window.electronMainProcess.extension_notificationProcessorInit();
        document.getElementById("extension_notification_processor_enable").checked = isEnabled;
        document.getElementById("extension_notification_processor_port_input").value = port;
        document.getElementById("extension_notification_processor_allow_cancel_notification_show").checked = allowCancelShow;
        //保存端口号数据
        document.getElementById("extension_notificationProcessorSaveButton").addEventListener("click", () => {
            const valueRaw = document.getElementById("extension_notification_processor_port_input").value;
            const value = parseInt(valueRaw);
            if (isNaN(value) || value <= 0 || value > 65535) {
                md.snackbar({
                    message: "端口号无效",
                    timeout: 1500
                });
                return
            }
            window.electronMainProcess.setConfig("extension_notificationProcessorPort", value);
            md.snackbar({
                message: "重启后生效",
                timeout: 1500
            });
        });
        //复制token
        document.getElementById("extension_notificationProcessorCopyKey").addEventListener("click", () => {
            if (token !== null) {
                navigator.clipboard.writeText(token);
                md.snackbar({
                    message: "已复制",
                    timeout: 1500
                });
            } else {
                md.snackbar({
                    message: "功能未开启 请开启后重启软件",
                    timeout: 1500
                });
            }
        });
        //暂时关闭
        document.getElementById("extension_notificationProcessorShutdownButton").addEventListener("click", () => {
            md.confirm({
                headline: "暂时关闭功能",
                description: "将断开插件连接且无法再接受连接直至软件重启,确认操作?",
                confirmText: "确认",
                cancelText: "取消",
                onConfirm: async () => {
                    window.electronMainProcess.extension_notificationProcessorShutdown();
                }
            })
        });
    }
}
export default ExtensionInit;