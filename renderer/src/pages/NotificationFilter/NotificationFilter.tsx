import { AppBar } from "~/components/AppBar";
import "mdui/components/tab"
import "mdui/components/tabs"
import "mdui/components/tab-panel"
import "mdui/components/list"
import "mdui/components/list-item"
import "mdui/components/list-subheader"
import "mdui/components/button-icon"
import "mdui/components/fab"
import useDevMode from "~/hooks/useDevMode";
import TextFilterPanel from "./components/TextFilterPanel";
import AppProfilePanel from "./components/AppProfilePanel";
export default function NotificationFilter() {
    useDevMode()
    return (
        <>
            <AppBar paddingLeft="3%" subtitle="通知过滤设置" />
            <mdui-tabs full-width value="textFilter" className="fixed top-9 w-full">
                <mdui-tab value="textFilter">内容过滤</mdui-tab>
                <mdui-tab value="appProfile">应用配置</mdui-tab>
                {/* 内容过滤面板 */}
                <TextFilterPanel />
                <AppProfilePanel />
            </mdui-tabs>
        </>
    )
}