import "mdui/components/navigation-rail"
import "mdui/components/navigation-rail-item"
import "mdui/components/tooltip"
import "mdui/components/button-icon"
import "mdui/components/badge"
import { type PageRouteProps } from "./PageRoute";
import type { NavigationRail as MduiNavigationRail } from "mdui/components/navigation-rail"
interface NavigationRailProps {
    onChange: (value: PageRouteProps["page"]) => void,
    hasNewTransmitMessage:boolean,
    value:PageRouteProps["page"]
}

export default function NavigationRail({
    onChange,
    hasNewTransmitMessage,
    value
}:NavigationRailProps) {
    return (
        <mdui-navigation-rail value={value} className="w-[10%] h-[91.5%] top-[8%]" onClick={event=>onChange((event.target as MduiNavigationRail)!.value as PageRouteProps["page"])}>
            {/* 未来改为功能菜单键 */}
            {/* <mdui-tooltip content="设置" slot="bottom">
                <mdui-button-icon icon=""/>
            </mdui-tooltip> */}
            {/* 逆天替ui库修bug */}
            <mdui-navigation-rail-item className="-ml-2 pl-[11.8%] w-[60%] whitespace-nowrap" icon="home" value="home">主页</mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="-ml-2 pl-[11.8%] w-[60%] whitespace-nowrap" icon="import_export" value="transmit">
                数据互传
                {hasNewTransmitMessage&&<mdui-badge slot="badge" variant="small"/>}
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="-ml-2 pl-[11.8%] w-[60%] whitespace-nowrap" icon="notifications" value="notification">
                通知转发
                <mdui-badge slot="badge" variant="small"/>
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="-ml-2 pl-[11.8%] w-[60%] whitespace-nowrap" icon="folder_open" value="file">
                文件浏览
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="-ml-2 pl-[11.8%] w-[60%] whitespace-nowrap" icon="extension" value="extension">
                扩展
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="-ml-2 pl-[11.8%] w-[60%] whitespace-nowrap" icon="settings" value="setting">
                设置
            </mdui-navigation-rail-item>
        </mdui-navigation-rail>
    )
}