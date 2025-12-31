type config = typeof import("../constant/notificationConfigTemplate.json");
//让ts编译包含文件
type profileType = typeof import("../constant/notificationProfileTemplate.json");
type TextFilterEditCommand = [
    "add" | "remove",
    string
]
import { app, Notification as ElectronNotification, BrowserWindow, ipcMain, nativeTheme, dialog } from "electron";
import windowsNotificationState from "windows-notification-state";
import windowsNotificationStateCode from "../constant/WindowsNotificationState";
import path from "path";
import fs from "fs-extra";
import Util from "./Util";
import NotificationProfileType from "../interface/INotificationProfile";
declare global {
    var clientMetadata: {
        androidId: string | "failed",
        androidSdkVersion: number,
        model: "UnknownModel" | string,
        oem: "UnknownOEM" | string,
        protocolVersion: number,
        toString: Function,
        sessionId: string
    }
}
class NotificationCore {
    private window: BrowserWindow | null;
    private configPath: string;
    private configSaverTimer: NodeJS.Timeout | number | string | null = null;
    private configSaving: boolean = false;
    #hasNotificationPermission;
    #hasXmlPermission: boolean;
    config: config;
    filterText: Set<string>;
    configWindow: BrowserWindow | null
    private LOG_TAG: string = "NotificationCore";
    private profilePath: string;
    private profile: Map<string, NotificationProfileType>;
    // enableOngoing: boolean;
    constructor() {
        /**
         * @type {BrowserWindow}
         */
        this.window = null;
        this.configWindow = null;
        //模板
        const jsonTemplate = require("../constant/notificationConfigTemplate.json");
        //主配置路径
        this.configPath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/config/notification.json`;
        //应用配置文件路径
        this.profilePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/config/notification/profile.json`;
        //主配置
        if (fs.existsSync(this.configPath)) {
            logger.writeInfo(`Notification manager config loaded`);
            try {
                this.config = fs.readJsonSync(this.configPath);
            } catch (error) {
                fs.outputJson(this.configPath, jsonTemplate);
                logger.writeInfo("Created new notification config file because load old config file failed");
                this.config = jsonTemplate;
            }
            //更新配置文件
            if (this.config._cfgVersion !== jsonTemplate._cfgVersion) {
                for (const prop of Object.keys(jsonTemplate)) {
                    if (!Reflect.has(this.config, prop)) {
                        Reflect.set(this.config, prop, jsonTemplate[prop]);
                    }
                }
                //更新版本号
                this.config._cfgVersion = jsonTemplate._cfgVersion;
                this.saveConfig();
                logger.writeInfo(`Notification config format version updated to:${this.config._cfgVersion}`);
            } else {
                //无需更新
                logger.writeInfo(`Notification config format version:${this.config._cfgVersion}`)
            }
        } else {
            fs.outputJson(this.configPath, jsonTemplate);
            //TODO 加入key检测模块 处理配置文件更新
            logger.writeInfo("Created new notification config file");
            this.config = jsonTemplate;
        };
        //应用单独配置
        if (fs.existsSync(this.profilePath)) {
            logger.writeInfo(`Notification profile loaded`);
            try {
                this.profile = new Map(Object.entries(fs.readJsonSync(this.profilePath)));
            } catch (error) {
                logger.writeError(`recreate notification profile file because crash:${error}`);
                dialog.showErrorBox("通知配置文件损坏", "将会重置配置以尝试修复 请在之后重新进行相关设置\n带来不便深感抱歉\n如该情况频繁发生请发送反馈");
                this.profile = new Map();
                fs.writeFile(this.profilePath, "{}");
            }
        } else {
            logger.writeInfo("Created new notification profile file");
            this.profile = new Map();
            fs.writeFile(this.profilePath, "{}");
        }
        //初始化过滤
        this.filterText = new Set<string>(this.config.filterText);
        //通知配置文件加载等
        this.#hasNotificationPermission = this.checkNotificationPermission();
        this.#hasXmlPermission = this.checkXmlPermission();
        this.ipcInit();
        logger.writeInfo("Notification manager init success");
    }
    /**
     * 
     * @param packageName 应用包名
     * @param time 时间戳
     * @param title 通知标题
     * @param content 内容
     * @param appName 应用名
     * @param ongoing 是否常驻通知
     * @param forwardToRendererProcess 是否转发给渲染进程
 
     * @returns 
     */
    onNewNotification(packageName: string, time: number, title: string, content: string, appName: string, key: string, progress:number,ongoing: boolean, forwardToRendererProcess: boolean = true): void {
        //检测
        //单配置检测(优先级最高 强制绕检测等)
        //返回缓存 用于推送时显示处理
        let result: {
            useProfile: boolean,
            title?: string,
            content?: string,
            appName?: string,
            enableTextFilter: boolean,
            show: boolean
        } = {
            useProfile: false,
            enableTextFilter: true,
            show: true
        };
        //实时通知显示 暂定不进行处理 直接推
        this.window?.webContents.send("webviewEvent", "currentNotificationUpdate", { type: "add", key, packageName, appName, title, content, time, ongoing ,progress});
        //熄屏检测
        if (!global.deviceConfig.getConfigProp("pushNotificationOnLockedScreen") && windowsNotificationStateCode.isLockedScreen(windowsNotificationState.shQueryUserNotificationState())) {
            result.show = false;
        };
        //全屏检测
        if (!global.deviceConfig.getConfigProp("pushNotificationOnFullScreen") && windowsNotificationStateCode.isFullscreen(windowsNotificationState.shQueryUserNotificationState())) {
            result.show = false;
        };
        //是否存在单独配置
        if (this.profile.has(packageName)) {
            const profile = this.profile.get(packageName) as NotificationProfileType;
            if (!profile.enableNotification) {
                logger.writeDebug(`Blocked notification from:${packageName}`);
                //不处理来自此程序的通知
                return
            }
            //处理单独配置
            if (profile.enableProfile) {
                result.useProfile = true;
                //过滤器
                result.enableTextFilter = profile.enableTextFilter;
                //不保存历史记录 直接不转发给渲染进程
                forwardToRendererProcess = !profile.disableRecord;
                //推送文本消息
                switch (profile.detailShowMode) {
                    case "none":
                        //不推送
                        logger.writeDebug(`Notification none push:${packageName}`)
                        result.show = false;
                        break;
                    case "all":
                        //全部显示
                        break
                    case "hide":
                        //全部隐藏 只能让人知道手机来了条通知
                        logger.writeDebug(`Notification pushed all hide:${packageName}`);
                        result.appName = "Suisho Connector";
                        result.title = "新通知";
                        result.content = "连接的手机收到一条通知";
                        break
                    case "nameOnly":
                        //只出来个应用名
                        logger.writeDebug(`Notification pushed name only:${packageName}`);
                        result.appName = "Suisho Connector";
                        result.title = "新通知";
                        result.content = `收到来自'${appName}'的通知`;
                        break
                    default:
                        logger.writeWarn(`Unknown notification forward show mode:${profile.detailShowMode}`);
                        break;
                }
            }
        }
        //无配置文件
        if (!result.useProfile) {
            switch (global.deviceConfig.getConfigProp("defaultNotificationShowMode")) {
                case "all":
                    //正常
                    break;
                case "nameOnly":
                    //只出来个应用名
                    logger.writeDebug(`Notification pushed name only:${packageName}`);
                    result.appName = "Suisho Connector";
                    result.title = "新通知";
                    result.content = `收到来自'${appName}'的通知`;
                    break
                case "none":
                    //不推送
                    logger.writeDebug(`Notification none push:${packageName}`)
                    result.show = false;
                case "hide":
                    //全部隐藏
                    logger.writeDebug(`Notification pushed all hide:${packageName}`);
                    result.appName = "Suisho Connector";
                    result.title = "新通知";
                    result.content = "连接的手机收到一条通知";
                    break
                default:
                    logger.writeWarn(`Unknown notification forward show mode:${global.deviceConfig.getConfigProp("defaultNotificationShowMode")}`);
                    break;
            }
        }
        //常驻通知过滤
        if (ongoing && !this.config.enableOngoing) {
            logger.writeDebug(`A notification blocked because is ongoing`);
            return
        }
        //文本检测 要求开启总过滤开关 如有单独配置则需要开启进行过滤
        if (this.config.enableTextFilter && (!result.useProfile || result.enableTextFilter)) {
            //根据模式处理
            if (this.config.filterMode === "blacklist") {//黑名单
                for (const text of this.filterText) {
                    if (title.includes(text) || content.includes(text)) {
                        logger.writeDebug(`A notification blocked by text filter(blacklist mode) from package:${packageName}`);
                        return
                    }
                }
            } else {//白名单
                //是否有关键词
                let passed = false;
                for (const value of this.filterText) {
                    if (title.includes(value) || content.includes(value)) {
                        logger.writeDebug(`A notification passed text filter(whitelist mode) from package:${packageName}`);
                        passed = true;
                        break
                    }
                }
                //无关键词
                if (!passed) return
            }
        }
        //转发给渲染进程 数据原封不动
        if (global.deviceConfig.getConfigProp("enableNotificationLog") && this.window !== null && forwardToRendererProcess) {
            this.window.webContents.send("webviewEvent", "notificationAppend", { packageName, appName, title, content, timestamp: time });
        }
        //是否推送
        if (!result.show) return
        //弹窗 根据配置进行过滤
        if (!this.#hasXmlPermission) {
            this.showCommonNotification(packageName, time, result.title || title, result.content || content, result.appName ?? appName);
        } else {
            this.showXmlNotification(packageName, time, result.title || title, result.content || content, result.appName ?? appName)
        }
    }
    /**
     * @description 检查是否允许发送通知
     * @memberof NotificationCore
     */
    checkNotificationPermission(): boolean {
        return windowsNotificationStateCode.sendable(windowsNotificationState.shQueryUserNotificationState());
    }
    /**
     * @description 检查xml格式通知权限
     * @memberof NotificationCore
     */
    checkXmlPermission(): boolean {
        //是否有开始菜单快捷方式
        return Util.hasStartMenuShortcut();
    }
    /**
     * @description  发送Electron自带最简单通知
     * @memberof NotificationCore
     */
    showCommonNotification(packageName: string, time: number, title: string, content: string, appName: string): void {
        logger.writeInfo(`Posted a common notification from:${packageName}`);
        const notificationInstance = new ElectronNotification({
            title: title,
            body: content,
            subtitle: appName
        });
        notificationInstance.addListener("click", (event) => {
            this.onNotificationClick(notificationInstance);
        })
            .show();
    }
    /**
     * @description 发送Windows Xml格式通知 支持显示应用名
     * @memberof NotificationCore
     */
    showXmlNotification(packageName: string, time: number, title: string, content: string, appName: string): void {
        logger.writeInfo(`Posted a notification from:${packageName}`);
        const notification = new ElectronNotification({
            toastXml:
                `
            <toast activationType="protocol" launch="suisho:clickNotification">
                <visual>
                    <binding template="ToastGeneric">
                        <text>${title}</text>
                        <text>${content}</text>
                        <text placement="attribution">${appName}</text>
                    </binding>
                </visual>
            </toast>
            `
        });
        notification.show();
    }
    private ipcInit(): void {
        //打开窗口
        ipcMain.handle("notification_openConfigWindow", (event, pkgName: string | null = null, appName: string | null = null): void => {
            logger.writeDebug("Open config window", this.LOG_TAG)
            this.openConfigWindow(pkgName, appName);
        });
        //获取数据
        ipcMain.handle("notificationForward_getTextFilterConfig", (event): config => {
            return this.config
        });
        //切换关键词过滤模式
        ipcMain.handle("notificationForward_changeTextFilterMode", (event) => {
            this.config.filterMode = this.config.filterMode === "blacklist" ? "whitelist" : "blacklist";
            this.saveConfig();
            logger.writeInfo(`Notification filter mode changed to ${this.config.filterMode}`);
        });
        //修改关键词列表内容配置
        ipcMain.handle("notificationForward_editTextFilterRule", (event, ...args: TextFilterEditCommand) => {
            args[0] === "add" ? this.filterText.add(args[1]) : this.filterText.delete(args[1]);
            this.saveConfig();
        });
        //加载目标应用通知配置 不存在则返回模板
        ipcMain.handle("notificationForward_getProfile", async (event, pkg: string) => {
            //获取配置或返回默认
            if (this.profile.has(pkg)) {
                return this.profile.get(pkg);
            }
            const temp: NotificationProfileType = require("../constant/notificationProfileTemplate.json");
            return temp
        });
        ipcMain.handle("notificationForward_saveProfile", async (event, pkg: string, newProfile: NotificationProfileType) => {
            this.profile.set(pkg, newProfile);
            await fs.writeJson(this.profilePath, Object.fromEntries(this.profile));
            logger.writeDebug("Saved notification app profile")
        });
    };
    setWindow(window: BrowserWindow): void {
        this.window = window;
        //拿到窗口对象 检测通知权限
        //xml格式通知
        if (!this.#hasXmlPermission) {
            setTimeout(() => {
                this.window?.webContents.send("webviewEvent", "editState", { type: "add", id: "warn_xml_notification_cannot_show" });
            }, 550);
            return
        }
    }
    /**
     *  通知点击事件
     * @param time 通知发送时间
     */
    onNotificationClick(notification?: ElectronNotification) {
        //打开主窗口
        if (this.window?.isMinimized()) {
            logger.writeDebug("Restore main window from notification click", this.LOG_TAG)
            this.window.restore()
        } else {
            logger.writeDebug("Show main window from notification click", this.LOG_TAG)
            this.window?.show();
        }
        this.window?.focus();
        this.window?.flashFrame(false)
        this.window?.webContents.send("webviewEvent", "focusNotification");
    }
    private async saveConfig() {
        if (this.configSaving) return
        this.configSaverTimer = setTimeout(async () => {
            this.configSaving = true;
            clearTimeout(this.configSaverTimer as NodeJS.Timeout);
            await this.updateConfigObject();
            await fs.writeJson(this.configPath, this.config);
            this.configSaving = false;
            logger.writeDebug("Notification forward config file saved", this.LOG_TAG)
        }, 300);
    }
    openConfigWindow(pkgName: string | null = null, appName: string | null = null) {
        if (this.configWindow === null) {
            this.configWindow = new BrowserWindow({
                center: true,
                titleBarStyle: "hidden",
                title: "通知过滤设置",
                resizable: false,
                autoHideMenuBar: true,
                frame: false,
                show: false,
                titleBarOverlay: {
                    height: 40,
                    color: nativeTheme.shouldUseDarkColors ? "#1d1b1e" : "#fdf7fe",
                    symbolColor: nativeTheme.shouldUseDarkColors ? "#fdf7fe" : "#1d1b1e"
                },
                webPreferences: {
                    webSecurity: app.isPackaged,
                    spellcheck: false,
                    contextIsolation: true,
                    // 逆天调试环境
                    preload: path.resolve(app.isPackaged ? "./dist/preload/notificationFilterSettingPreload.js" : "./src/preload/notificationFilterSettingPreload.js")
                }
            });
            this.configWindow.setMenu(null);
            //成功关闭时
            this.configWindow.setContentProtection(global.config.enableContentProtection);
            this.configWindow.on("closed", () => {
                logger.writeDebug("Config window closed", this.LOG_TAG);
                this.configWindow = null;
            });
            //直接打开指定软件设置
            if (pkgName !== null && appName !== null) {
                logger.writeDebug(`Request open target package notification setting:${pkgName}`, this.LOG_TAG);
                app.isPackaged ? this.configWindow.loadFile("./dist/renderer/index.html", { hash: "notification-filter", query: { pkgName, appName } }) : this.configWindow.loadURL(`http://localhost:5173/#/notification-filter?pkgName=${pkgName}&appName=${appName}`);
            } else {
                app.isPackaged ? this.configWindow.loadFile("./dist/renderer/index.html", { hash: "notification-filter" }) : this.configWindow.loadURL("http://localhost:5173/#/notification-filter");
            }
            this.configWindow.hookWindowMessage(278, () => {
                this.configWindow?.setEnabled(false);
                setTimeout(() => {
                    this.configWindow?.setEnabled(true);
                }, 50);
            });
            this.configWindow.once("ready-to-show", () => {
                this.configWindow?.setMaximizable(false);
                logger.writeDebug("Config window showed", this.LOG_TAG);
                this.configWindow?.show();
            });
        } else if (pkgName !== null && appName !== null) {
            logger.writeDebug(`Request change to target package notification setting:${pkgName}`, this.LOG_TAG);
            app.isPackaged ? this.configWindow.loadFile("./dist/renderer/index.html", { hash: "notification-filter", query: { pkgName, appName } }) : this.configWindow.loadURL(`http://localhost:5173/#/notification-filter?pkgName=${pkgName}&appName=${appName}`);
            if (this.configWindow.isMinimized()) {
                this.configWindow.restore();
            }
            this.configWindow?.focus();
        } else {
            logger.writeDebug("Config window focused", this.LOG_TAG);
            //处理被最小化
            if (this.configWindow.isMinimized()) {
                this.configWindow.restore();
            }
            this.configWindow?.focus();
        }
    }
    private async updateConfigObject() {
        //临时关键词列表
        const tempFilterTextList: string[] = [];
        //转录关键词
        for (const text of this.filterText) {
            tempFilterTextList.push(text);
        };
        (<string[]>this.config.filterText) = tempFilterTextList;
        logger.writeDebug("Config object update success")
    }
    recheckXmlPermission(): void {
        this.#hasXmlPermission = this.checkNotificationPermission();
        logger.writeInfo(`Recheck xml notification permission result: ${this.#hasXmlPermission}`, this.LOG_TAG)
    }
}
// module.exports = NotificationCore;
export default NotificationCore;