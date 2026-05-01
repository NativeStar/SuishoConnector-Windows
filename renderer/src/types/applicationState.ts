import { confirm, dialog, snackbar } from "mdui";
import type { StateAction } from "~/pages/Home/Home";
import type { UpdateJson } from "./chaos";
export const ApplicationStateLevel = {
    Checked: 0,
    Busy: 1,
    Info: 2,
    Warn: 3,
    Error: 4
} as const
export interface ApplicationState {
    level: typeof ApplicationStateLevel[keyof typeof ApplicationStateLevel],
    title: string,
    content: string,
    clickable: boolean,
    onClick?: (dispatch: React.ActionDispatch<StateAction>) => void
}
const States = {
    busy_waiting_icon_pack: {
        level: ApplicationStateLevel.Busy,
        title: "正在下载图标包",
        content: "这会需要一段时间",
        clickable: false,
    },
    info_update_available: {
        level: ApplicationStateLevel.Info,
        title: "发现新版本",
        content: "点击跳转至Github下载",
        clickable: true,
        onClick() {
            snackbar({
                message: "解析更新数据...",
                autoCloseDelay: 750
            });
            const rawUpdateJsonString = sessionStorage.getItem("updateJson");
            if (!rawUpdateJsonString) {
                confirm({
                    headline: "解析数据失败",
                    description: "但您仍可以前往Github Release页面手动检查和下载更新",
                    confirmText: "跳转",
                    cancelText: "取消",
                    onConfirm: () => {
                        window.electronMainProcess.openUrl("https://github.com/NativeStar/SuishoConnector-Windows/releases")
                    }
                }).catch(() => { });
                return
            }
            const updateJson :UpdateJson= JSON.parse(rawUpdateJsonString)
            dialog({
                actions: [
                    { text: "前往发布页" ,onClick:()=>window.electronMainProcess.openUrl("https://github.com/NativeStar/SuishoConnector-Windows/releases")},
                    { text: "取消" },
                    // 跳转浏览器下载
                    { text: "下载" ,onClick:()=>window.electronMainProcess.openUrl(updateJson.downloadUrl)}
                ],
                headline: `发现新版本:${updateJson.versionName}`,
                description: updateJson.description
            })
        }
    },
    info_device_not_trusted: {
        level: ApplicationStateLevel.Info,
        title: "此计算机不被信任",
        content: "将只运行基础功能",
        clickable: false
    },
    info_device_idle: {
        level: ApplicationStateLevel.Info,
        title: "Doze模式",
        content: "设备已进入低功耗模式 数据同步可能延迟",
        clickable: false
    },
    warn_xml_notification_cannot_show: {
        level: ApplicationStateLevel.Warn,
        title: "通知显示异常",
        content: "通知内容可能不全\n请检查桌面或开始菜单是否有该软件快捷方式\n(系统限制)",
        clickable: true,
        onClick() {
            confirm({
                headline: "创建开始菜单快捷方式?",
                description: "由于系统限制,无快捷方式的应用可能无法显示通知",
                confirmText: "创建",
                cancelText: "取消",
                onConfirm: async () => {
                    // 直接调用算了
                    window.electronMainProcess.createStartMenuShortcut()
                }
            })
        },
    },
    warn_watch_directory_missing: {
        level: ApplicationStateLevel.Warn,
        title: "已取消同步异常的文件夹",
        content: "部分目录无法读取\n可能是目录被删除或发生权限变更\n点击关闭该通知",
        clickable: true,
        onClick(dispatch) {
            //只是提醒用状态 移除自身
            dispatch({ type: "remove", id: "warn_watch_directory_missing" })
        }
    },
    warn_android_client_version_low: {
        level: ApplicationStateLevel.Warn,
        title: "Android端版本低",
        content: "部分功能可能无法工作",
        clickable: false,
    },
    error_phone_file_server: {
        level: ApplicationStateLevel.Error,
        title: "文件浏览初始化异常",
        content: "部分相关功能可能无法工作\n请尝试清理数据重启软件",
        clickable: false
    }
} satisfies Record<string, ApplicationState>;
export type States = keyof typeof States;
export function getStateInstance(stateId: keyof typeof States) {
    const targetStateInstance = States[stateId] as ApplicationState;
    return targetStateInstance
}