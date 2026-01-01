import { confirm } from "mdui";
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
    onClick?: () => void
}
const States = {
    busy_waiting_icon_pack: {
        level: ApplicationStateLevel.Busy,
        title: "正在下载图标包",
        content: "这会需要一段时间",
        clickable: false,
    },
    info_device_not_trusted: {
        level: ApplicationStateLevel.Info,
        title: "此计算机不被信任",
        content: "将只运行基础功能",
        clickable: false
    },
    warn_xml_notification_cannot_show: {
        level: ApplicationStateLevel.Warn,
        title: "通知显示异常",
        content: "通知内容可能不全\n请检查桌面或开始菜单是否有该软件快捷方式\n(系统限制)",
        clickable: true,
        onClick() {
            console.log("click");
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