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
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { setColorScheme } from "mdui";
export default function NotificationFilter() {
    useDevMode();
    setColorScheme("#895cad")
    const [searchParams]=useSearchParams();
    const [tabValue,setTabValue]=useState<"textFilter"|"appProfile">("textFilter");
    useEffect(() => {
        // 获取当前配置
        const targetAppPkgName = searchParams.get("pkgName");
        const targetAppName = searchParams.get("appName");
        if (targetAppPkgName && targetAppName) {
            setTabValue("appProfile");
        }
    }, [searchParams])
    return (
        <>
            <AppBar paddingLeft="3%" subtitle="通知过滤设置" />
            <mdui-tabs full-width value={tabValue} className="fixed top-9 w-full">
                <mdui-tab value="textFilter">内容过滤</mdui-tab>
                <mdui-tab value="appProfile">应用配置</mdui-tab>
                {/* 内容过滤面板 */}
                <TextFilterPanel />
                <AppProfilePanel packageName={searchParams.get("pkgName")} appName={searchParams.get("appName")}/>
            </mdui-tabs>
        </>
    )
}