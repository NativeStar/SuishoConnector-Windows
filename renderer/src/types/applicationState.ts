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
    WaitingIconPack:{
        level:ApplicationStateLevel.Busy,
        title:"正在下载图标包",
        content:"这会需要一段时间",
        clickable:false,
    },
    DeviceNotTrusted:{
        level:ApplicationStateLevel.Info,
        title:"此计算机不被信任",
        content:"将只运行基础功能",
        clickable:false
    },
    XmlNotificationCannotShow:{
        level:ApplicationStateLevel.Warn,
        title:"通知显示异常",
        content:"通知内容可能不全\n请检查桌面或开始菜单是否有该软件快捷方式\n(系统限制)",
        clickable:true
    },
    PhoneFileServer:{
        level:ApplicationStateLevel.Error,
        title:"文件浏览初始化异常",
        content:"部分相关功能可能无法工作\n请尝试清理数据重启软件",
        clickable:false
    },
    NotificationProcessorPortInUse:{
        level:ApplicationStateLevel.Error,
        title:"通知处理扩展端口被占用",
        content:"请尝试关闭占用端口的程序或更改端口号后重启软件",
        clickable:false
    }
} satisfies Record<string,ApplicationState>;
export type States=keyof typeof States;
export function getStateInstance(stateId:keyof typeof States,onClick?:()=>void){
    const targetStateInstance = States[stateId] as ApplicationState;
    if (targetStateInstance.clickable) {
        targetStateInstance.onClick = onClick
    }
    return targetStateInstance
}