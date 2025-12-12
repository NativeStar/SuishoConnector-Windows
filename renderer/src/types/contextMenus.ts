import { type RightClickMenuItem, RightClickMenuItemId } from "shared/const/RightClickMenuItems";
export const TransmitMessageListMenu: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Upload,
        label: "上传文件"
    }
];
export const TransmitMessageMenuCommonText = [
    {
        id: RightClickMenuItemId.Copy,
        label: "复制"
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
];
export const TransmitMessageMenuSelectedCommonText = [
    {
        id: RightClickMenuItemId.Copy,
        label: "复制选中"
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
];
export const TransmitMessageMenuUrlText = [
    {
        id: RightClickMenuItemId.OpenUrl,
        label: "打开链接"
    },
    {
        id: RightClickMenuItemId.Copy,
        label: "复制"
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
]
export const TransmitMessageMenuSelectedUrlText = [
    {
        id: RightClickMenuItemId.OpenUrl,
        label: "打开选中链接"
    },
    {
        id: RightClickMenuItemId.Copy,
        label: "复制选中"
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    },
]
export const TransmitMessageMenuFile = [
    {
        id: RightClickMenuItemId.OpenInExplorer,
        label: "在资源管理器中查看",
        enabled: true
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
]
export const NotificationItemNotSelectedText = [
    {
        id: RightClickMenuItemId.CopyTitle,
        label: "复制标题"
    },
    {
        id: RightClickMenuItemId.CopyContent,
        label: "复制内容"
    },
    {
        id: RightClickMenuItemId.OpenNotificationApplicationPanel,
        label: "管理应用通知",
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
]
export const FileManagerDownload=[
    {
        id:RightClickMenuItemId.Download,
        label:"下载文件"
    }
]