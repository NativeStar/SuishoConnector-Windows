import "mdui/components/navigation-rail"
import "mdui/components/navigation-rail-item"
import "mdui/components/tooltip"
import "mdui/components/button-icon"
import "mdui/components/badge"
import { type PageRouteProps } from "./PageRoute";
import type { NavigationRail as MduiNavigationRail } from "mdui/components/navigation-rail"
interface NavigationRailProps {
    onChange: (value: PageRouteProps["page"]) => void
}

export default function NavigationRail({
    onChange
}:NavigationRailProps) {
    return (
        <mdui-navigation-rail value="home" className="w-[10%] h-[91.5%] top-[8%]" onChange={event=>onChange((event.target as MduiNavigationRail)!.value as PageRouteProps["page"])}>
            {/* 未来改为功能菜单键 */}
            {/* <mdui-tooltip content="设置" slot="bottom">
                <mdui-button-icon icon=""/>
            </mdui-tooltip> */}
            {/* 逆天邪修替ui库修bug:ml-5 pr-5.5 */}
            <mdui-navigation-rail-item className="ml-5 pr-5.5" icon="home" value="home">主页</mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="ml-5 pr-5.5 mt-1" icon="import_export" value="transmit">
                数据互传
                <mdui-badge slot="badge" variant="small"/>
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="ml-5 pr-5.5 mt-1" icon="notifications" value="notification">
                通知转发
                <mdui-badge slot="badge" variant="small"/>
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="ml-5 pr-5.5 mt-1" icon="folder_open" value="file">
                文件浏览
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="ml-5 pr-5.5 mt-1" icon="extension" value="extension">
                扩展
            </mdui-navigation-rail-item>
            <mdui-navigation-rail-item className="ml-5 pr-5.5 mt-1" icon="settings" value="setting">
                设置
            </mdui-navigation-rail-item>
        </mdui-navigation-rail>
    )
}