import * as md from "../../modules/mdui.esm.js";
import StateBarInit from "../init/stateBarInit.js";
const Level={
    checked:0,
    busy:1,
    info:2,
    warn:3,
    error:4
}
/**
 * @type  {Map<string,{level:number,title:string,content:string,clickable:boolean,onclick:Function}>}
 */
const States=new Map([
    ["busy_waiting_icon_pack",{level:Level.busy,title:"正在下载图标包",content:"这会需要一段时间",clickable:false,onclick:null}],
    ["info_device_not_trusted",{level:Level.info,title:"此计算机不被信任",content:"将只运行基础功能",clickable:false,onclick:null}],
    ["warn_xml_notification_cannot_show",{level:Level.warn,title:"通知显示异常",content:`通知内容可能不全\n请检查桌面或开始菜单是否有该软件快捷方式\n(系统限制)`,clickable:true,onclick:()=>{
        md.confirm({
            headline: "创建开始菜单快捷方式?",
            description: "由于系统限制,无快捷方式的应用可能无法显示通知",
            confirmText: "创建",
            cancelText: "取消",
            onConfirm:async ()=>{
                if(await window.electronMainProcess.createStartMenuShortcut()){
                    StateBarInit.removeState("warn_xml_notification_cannot_show");
                }
            }
        })
    }}],
    [
        "error_database_init",{level:Level.error,title:"数据库初始化异常",content:"部分功能无法工作\n请尝试重新连接",clickable:false,onclick:null}
    ],
    ["error_phone_file_server",{level:Level.error,title:"文件浏览初始化异常",content:"部分相关功能可能无法工作\n请尝试清理数据重启软件",clickable:false,onclick:null}],
    ["error_notification_processor_port_in_use",{level:Level.error,title:"通知处理扩展端口被占用",content:"请尝试关闭占用端口的程序或更改端口号后重启软件",clickable:false,onclick:null}]
]);
export default States
export {
    Level,
    States
}