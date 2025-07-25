enum RightClickMenuItemId{
    Null=-1,//未选择
    Copy,//复制
    Cut,//剪切
    Paste,//粘贴
    Delete,//删除
    Upload,//上传
    OpenInExplorer,//资源管理器中打开
    CopyTitle,//通知转发 复制标题
    CopyContent,//通知转发 复制内容
    OpenUrl,//打开链接
    OpenSelectedUrl//打开选中的链接
}
interface RightClickMenuItem{
    id:RightClickMenuItemId;
    label:string;
    enabled?:boolean;
    // icon:string;
    // click:()=>void;
}
export {
    RightClickMenuItemId,
    RightClickMenuItem
}