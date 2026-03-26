import { type RightClickMenuItem, RightClickMenuItemId } from "shared/const/RightClickMenuItems";
export const TransmitMessageListMenu: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Upload,
        label: "上传文件"
    },
    {
        id:RightClickMenuItemId.OpenTransmitFolder,
        label:"打开互传文件夹"
    }
];
export const TransmitMessageMenuCommonText: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Copy,
        label: "复制"
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
];
export const TransmitMessageMenuSelectedCommonText: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Copy,
        label: "复制选中"
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除"
    }
];
export const TransmitMessageMenuUrlText: RightClickMenuItem[] = [
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
export const TransmitMessageMenuSelectedUrlText: RightClickMenuItem[] = [
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
export const TransmitMessageMenuFile: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.OpenInExplorer,
        label: "在资源管理器中查看",
        enabled: true
    },
    {
        id: RightClickMenuItemId.DeleteWithFile,
        label: "删除消息和文件",
        enabled: true
    },
    {
        id: RightClickMenuItemId.Delete,
        label: "删除消息"
    }
]
export const NotificationItemNotSelectedText: RightClickMenuItem[] = [
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
export const FileManagerDownload: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Download,
        label: "下载文件"
    }
]
export const FileManagerStarDirectory: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Star,
        label: "收藏目录"
    }
]
export const FileManagerUnStarDirectory: RightClickMenuItem[] = [
    {
        id: RightClickMenuItemId.Delete,
        label: "删除收藏"
    }
]