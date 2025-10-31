import RightClickMenuItem from './RightClickMenuItem.js';
class RightClickMenus{
    //互传文本
    static MENU_TRANSMIT_TEXT=[
        {
            id:RightClickMenuItem.Copy,
            label:"复制"
        },
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        }
    ];
    static MENU_TRANSMIT_TEXT_HAS_URL=[
        {
            id:RightClickMenuItem.OpenUrl,
            label:"打开链接"
        },
        {
            id:RightClickMenuItem.Copy,
            label:"复制"
        },
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        }
    ];
    //已有选中文本时的互传和通知转发 右键
    static MENU_TRANSMIT_TEXT_SELECTED=[
        {
            id:RightClickMenuItem.Copy,
            label:"复制选中"
        },
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        }
    ];
    static MENU_TRANSMIT_URL_SELECTED=[
        {
            id:RightClickMenuItem.OpenSelectedUrl,
            label:"打开选中链接"
        },
        {
            id:RightClickMenuItem.Copy,
            label:"复制选中"
        },
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        },
    ]
    //文件
    static MENU_TRANSMIT_FILE=[
        {
            id:RightClickMenuItem.OpenInExplorer,
            label:"在资源管理器中查看",
            enabled:true
        },
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        }
    ];
    //空白处右键
    static MENU_TRANSMIT_NONE_ELEMENT=[
        {
            id:RightClickMenuItem.Upload,
            label:"上传文件"
        }
    ];
    static MENU_NOTIFICATION_NOT_SELECTION=[
        {
            id:RightClickMenuItem.CopyTitle,
            label:"复制标题"
        },
        {
            id:RightClickMenuItem.CopyContent,
            label:"复制内容"
        },
        {
            id:RightClickMenuItem.OpenNotificationApplicationPanel,
            label:"管理应用通知",
        },
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        }
    ];
    static MENU_FILE_MANAGER_STARED_DIRECTORY=[
        {
            id:RightClickMenuItem.Delete,
            label:"删除"
        }
    ];
    static MENU_FILE_MANAGER_FILE_ITEM=[
        {
            id:RightClickMenuItem.Download,
            label:"下载"
        }
    ];
}
export default RightClickMenus;