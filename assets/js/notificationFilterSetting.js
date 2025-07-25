import developing from "../modules/developing.js";
import * as md from "../modules/mdui.esm.js";
import { NotificationProfilePanel } from "./class/NotificationProfilePanel.js";
/**
 * @typedef config
 * @property {boolean} enable
 * @property {boolean} enableOngoing 
 * @property {{}[]} appSettings
 * @property {boolean} enableTextFilter
 * @property {string[]} filterText
 * @property {"blacklist"|"whitelist"} filterMode
 */
/**
 * @typedef NotificationProfile
 * @property {boolean} enableProfile
 * @property {boolean} enableNotification
 * @property {"all"|"nameOnly"|"hide"|"none"} detailShowMode
 * @property {boolean} enableTextFilter
 * @property {boolean} enableDeepHidden
 * @property {boolean} disableRecord
 */
/**
 * @type {config}
 */
let forwardConfig;
/**
 * @type {HTMLDivElement}
 */
let deviceDataPath;
/**
 * @description 应用列表
 * @type {{
 *  packageName: string,
 *  appName:string,
 *  isSystemApp:boolean
 * }[]}
 */
let appList = null;
/**
 * @type {NotificationProfile}
 */
let tempProfile = {
    enableProfile: true,
    enableNotification: true,
    detailShowMode: "all",
    enableTextFilter: true,
    enableDeepHidden: false,
    disableRecord: false
};
const currentPkgInfo = {
    packageName: ""
}
//禁止所有拖动
document.addEventListener("dragstart", (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false
});
document.addEventListener("selectstart", (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false
});
//窗口焦点事件 改变标题文本颜色
window.addEventListener("focus", () => {
    document.getElementById("titleBar").classList.add("titleBarNotFocus");
});
window.addEventListener("blur", () => {
    document.getElementById("titleBar").classList.remove("titleBarNotFocus");
});
document.addEventListener("select", event => {
    return true
});
document.addEventListener("mousedown", event => {
    if (event.button === 1) {
        event.preventDefault()
    }
})
window.addEventListener("load", () => {
    window.electronMainProcess.isDeveloping().then(value => {
        if (value) {
            developing.inject();
        }
    });
    //阻止目标元素冒泡
    document.querySelectorAll(".notPropagation").forEach(element => {
        element.addEventListener("click", (event) => {
            event.stopPropagation();
        })
    })
    //通知总开关
    document.getElementById("appEnableNotificationSwitch").addEventListener("change", event => {
        document.getElementById("appProfileSwitch").disabled = !event.target.checked;
        tempProfile.enableNotification = event.target.checked;
        saveAppProfile();
        //未启用单独配置时提示 注意单独配置关闭时提醒
        if (!event.target.checked) {
            changeTipMaskState(true, NotificationProfilePanel.ProfileTipsMaskText.DISABLED);
        } else if (!document.getElementById("appProfileSwitch").checked) {
            changeTipMaskState(true, NotificationProfilePanel.ProfileTipsMaskText.PROFILE_DISABLED);
        } else {
            changeTipMaskState(false);
        }
    });
    //单独配置开关
    document.getElementById("appProfileSwitch").addEventListener("change", event => {
        //下面是单独配置区
        document.getElementById("appProfileModeSelect").disabled = !event.target.checked;
        tempProfile.enableProfile = event.target.checked;
        changeTipMaskState(!event.target.checked, NotificationProfilePanel.ProfileTipsMaskText.PROFILE_DISABLED);
        saveAppProfile();
    });
    //内容过滤开关
    document.getElementById("profileEnableTextFilterSwitch").addEventListener("change", event => {
        tempProfile.enableTextFilter = event.target.checked;
        saveAppProfile();
    });
    //深度隐藏开关
    document.getElementById("deepHiddenSwitch").addEventListener("change", event => {
        tempProfile.enableDeepHidden = event.target.checked;
        md.snackbar({
            message: "重启程序后生效",
            autoCloseDelay: 800
        })
        saveAppProfile();
    });
    //保存历史记录开关
    document.getElementById("profileDisableRecord").addEventListener("change", event => {
        tempProfile.disableRecord = event.target.checked;
        saveAppProfile();
    })
    //应用配置列表过滤器搜索框
    document.getElementById("profileAppFilterInput").addEventListener("keyup", event => {
        if (event.key === "Enter") {
            /**
             * @type {string}
             */
            const inputText = event.target.value;
            document.getElementById("appProfileListLoadingProgress").hidden = false;
            //功能冲突 清除过滤
            document.getElementById("appTypeFilterButtonGroup").value = ""
            document.querySelectorAll(".appProfileListItem").forEach((element) => {
                //天知道为啥hidden没用
                element.style.display = element.getAttribute("headline").toLowerCase().includes(inputText.toLowerCase()) ? "block" : "none"
            });
            document.getElementById("appProfileListLoadingProgress").hidden = true;
        }
    });
    //应用配置列表搜索框清空按钮事件
    document.getElementById("profileAppFilterInput").addEventListener("clear", () => {
        document.querySelectorAll(".appProfileListItem").forEach((element) => {
            element.style.display = "block"
        });
    })
    //应用配置列表类型过滤
    document.getElementById("appTypeFilterButtonGroup").addEventListener("change", (event) => {
        //啥都没选 不过滤
        if (event.target.value === "") {
            document.querySelectorAll(".appProfileListItem").forEach((element) => {
                element.style.display = "block"
            });
        } else {
            document.querySelectorAll(".appProfileListItem").forEach((element) => {
                element.style.display = element.getAttribute("from") === event.target.value ? "block" : "none"
            });
        }
        // console.log(event.target.value)
    })
    const appProfileList = document.getElementById('appProfileAppList');
    (async () => {
        /**
         * @type {config}
         */
        forwardConfig = await electronMainProcess.getTextFilterConfig();
        //跳转对应应用设置页面参数
        const params = new URLSearchParams(location.search);
        const targetAppPkgName = params.get("pkgName");
        const targetAppName = params.get("appName");
        if (targetAppPkgName !== null && targetAppName !== null) {
            document.getElementById("appProfileTab").click();
        }
        //查询所有软件包
        window.electronMainProcess.getPackageList().then(async (value) => {
            //缓存应用列表
            appList = value.data;
            //判断是否有权限
            if (value.length === 0) {
                document.getElementById("appProfilePanelTipText").hidden = false;
                document.getElementById("appProfilePanelTipText").innerText = `需要在手机端授予本程序获取应用列表权限
                并建议选择"始终允许"而不是"仅在使用中允许"`;
                return
            };
            deviceDataPath = await window.electronMainProcess.getDeviceDataPath();
            const appListFragment = document.createDocumentFragment();
            const appListData = await Promise.all(value.data.map((pkgInfo) => {
                return createAppProfileAppListElement(pkgInfo.packageName, pkgInfo.appName, pkgInfo.isSystemApp);
            }));
            for (const appListItem of appListData) {
                appListFragment.appendChild(appListItem);
            }
            appProfileList.appendChild(appListFragment);
            document.getElementById("appProfileListLoadingProgress").hidden = true;
            document.getElementById("appProfilePanelTipText").hidden = false;
            //跳转到目标应用
            if (targetAppPkgName !== null && targetAppName !== null) {
                //清空提示词
                document.getElementById("appProfilePanelTipText").hidden = true;
                //显示正常操控面板
                document.getElementById("appProfileDetailPanel").style.display = "block";
                changeAppProfilePanel(targetAppPkgName, targetAppName);
            }
        });
        await generateTextFilterList();
        // console.log(textFilterConfig);
    })();
    //添加关键词
    document.getElementById("addTextFilter").addEventListener("click", () => {
        md.prompt({
            headline: "添加关键词",
            description: "将根据设置进行过滤",
            confirmText: "添加",
            cancelText: "取消",
            /**
             * @param {string} value 
             */
            onConfirm: (value) => {
                if (value.toString().replaceAll(" ", "") === "") {
                    return
                }
                document.getElementById("textFilterList").appendChild(getListItemElement(value.toString()));
                window.electronMainProcess.editTextFilterRule("add", value.toString());
                updateTextFilterListEmptyTip();
            },
            //库本身有bug
        }).catch(() => { });
    })
    //过滤模式
    document.getElementById("textFilterModeChange").addEventListener("click", () => {
        window.electronMainProcess.changeTextFilterMode();
        md.snackbar({
            message: `过滤模式切换为:${forwardConfig.filterMode === "blacklist" ? "白名单" : "黑名单"}`,
            autoCloseDelay: 1250
        });
        forwardConfig.filterMode = forwardConfig.filterMode === "blacklist" ? "whitelist" : "blacklist";
    });
    //推送模式切换监听
    document.getElementById("appProfileModeSelect").addEventListener("change", function (event) {
        //空选择检查
        if (this.value === "") {
            this.value = tempProfile.detailShowMode;
        } else {
            // tempProfile.detailShowMode = this.value;
            //只在选择有效时保存配置
            tempProfile.detailShowMode = this.value;
            saveAppProfile();
        }
        //如果选择了空 恢复正常勾选状态
        setTimeout(() => {
            for (const itemElement of this.children) {
                this.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
            }
        }, 120);
    });
    //刷新列表
    document.getElementById("forceRefreshAppListItem").addEventListener("click",()=>{
        window.electronMainProcess.getPackageList(true)
    })
});
/**
 * @description 构造关键词列表
 */
async function generateTextFilterList() {
    const fragment = document.createDocumentFragment();
    for (const text of forwardConfig.filterText) {
        fragment.appendChild(getListItemElement(text));
    }
    document.getElementById("textFilterList").appendChild(fragment);
    updateTextFilterListEmptyTip();
}
/**
 * @param {string} text
 */
function getListItemElement(text) {
    const listItem = document.createElement("mdui-list-item");
    listItem.setAttribute("headline", text);
    const removeButton = document.createElement("mdui-button-icon");
    removeButton.setAttribute("icon", "close");
    //双击移除
    removeButton.addEventListener("click", function () {
        const text = this.parentElement.getAttribute("headline");
        window.electronMainProcess.editTextFilterRule("remove", text.toString());
        md.snackbar({
            message: `已删除关键词:${text}`,
            autoCloseDelay: 2500,
            action: "撤销",
            onActionClick: () => {
                document.getElementById("textFilterList").appendChild(getListItemElement(text));
                window.electronMainProcess.editTextFilterRule("add", text.toString());
                //删干净了
                updateTextFilterListEmptyTip();
            }
        });
        this.parentElement.remove();
        updateTextFilterListEmptyTip();
    });
    removeButton.setAttribute("slot", "end-icon");
    listItem.appendChild(removeButton);
    return listItem;
}
/**
 * @description 切换应用配置面板
 * @param {string} pkg 目标包名
 * @param {string} name 
 */
async function changeAppProfilePanel(pkg, name) {
    if (!appList.some((value) => value.packageName === pkg)) {
        md.alert({
            headline: "未找到目标应用",
            description: "该应用可能被卸载",
            confirmText: "确定",
            onConfirm: () => window.close()
        });
        return
    }
    /**
     * @type {NotificationProfile}
     */
    const profile = await window.electronMainProcess.getProfile(pkg);
    tempProfile = profile;
    currentPkgInfo.packageName = pkg;
    //调整开关类元素状态
    document.getElementById("appEnableNotificationSwitch").checked = profile.enableNotification;
    document.getElementById("appProfileSwitch").checked = profile.enableProfile;
    //如果不接受通知 禁用配置开关
    document.getElementById("appProfileSwitch").disabled = !profile.enableNotification;
    //显示提示并隐藏详细设置面板
    if (!profile.enableNotification) {
        changeTipMaskState(true, NotificationProfilePanel.ProfileTipsMaskText.DISABLED);
    } else if (!profile.enableProfile) {
        changeTipMaskState(true, NotificationProfilePanel.ProfileTipsMaskText.PROFILE_DISABLED);
    } else {
        changeTipMaskState(false)
    }
    //推送模式选项
    document.getElementById("appProfileModeSelect").value = profile.detailShowMode;
    //过滤器开关
    document.getElementById("profileEnableTextFilterSwitch").checked = profile.enableTextFilter;
    // console.log(profile);
    document.getElementById("controlPanelAppIcon").setAttribute("src", `${deviceDataPath}assets/iconCache/${pkg}`);
    document.getElementById("deepHiddenSwitch").checked = profile.enableDeepHidden;
    document.getElementById("profileDisableRecord").checked = profile.disableRecord;
    document.getElementById("controlPanelAppName").innerText = name;
}
async function saveAppProfile() {
    //直接用tempProfile
    await window.electronMainProcess.saveProfile(currentPkgInfo.packageName, tempProfile);
}
/**
 * @description 更新空列表时提示词状态
 */
function updateTextFilterListEmptyTip() {
    //通过列表中是否有元素判断
    document.getElementById("textFilterTip").hidden = document.getElementById("textFilterList").querySelectorAll("mdui-list-item").length !== 0;
}
/**
 * @description 是否显示提示遮罩
 * @param {boolean} state 是否展示
 * @param {string?} text 
 */
function changeTipMaskState(state, text = null) {
    if (text != null) document.getElementById("panelDisabledTip").innerText = text;
    document.getElementById("detailProfilePanel").hidden = state;
    document.getElementById("panelDisabledTip").hidden = !state;
}
/**
 * 创建应用列表元素
 * @param {string} pkg 
 * @param {string} name 
 * @param {boolean} isSystemApp 
 * @returns 
 */
async function createAppProfileAppListElement(pkg, name, isSystemApp = false) {
    const element = document.createElement("mdui-list-item");
    //标题
    element.setAttribute("headline", name);
    //包名属性
    // element.setAttribute("packageName", pkg);
    //来源
    element.setAttribute("from", isSystemApp ? "system" : "user");
    //class 文本换行
    element.classList.add("appProfileListItem");
    //箭头
    element.setAttribute("end-icon", "arrow_right");
    const avatar = document.createElement("mdui-avatar");
    avatar.setAttribute("slot", "icon");
    //class 圆角
    avatar.classList.add("mduiAvatarBorder");
    //图片
    avatar.setAttribute("src", `${deviceDataPath}assets/iconCache/${pkg}`);
    //禁止拖动
    // avatar.addEventListener("dragstart", (e) => {
    //     e.preventDefault();
    // });
    element.appendChild(avatar);
    element.addEventListener("click", () => {
        //清空提示词
        document.getElementById("appProfilePanelTipText").hidden = true;
        //显示正常操控面板
        document.getElementById("appProfileDetailPanel").style.display = "block";
        changeAppProfilePanel(pkg, name);
    });
    return element;
}