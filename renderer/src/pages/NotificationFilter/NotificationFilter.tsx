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
import useNotificationFilterWindowIpc from "~/hooks/ipc/useNotificationFilterWindowIpc";
import { useEffect, useState } from "react";
import { prompt, snackbar } from "mdui";

function TextFilterPanel() {
    // TODO reducer
    const [textFilter, setTextFilter] = useState<string[]>([]);
    const [filterMode, setFilterMode] = useState<"blacklist" | "whitelist">("blacklist");
    const ipc = useNotificationFilterWindowIpc();
    useEffect(() => {
        ipc.getTextFilterConfig().then(result => {
            setFilterMode(result.filterMode);
            // console.log(result);
            setTextFilter(result.filterText);
        })
    }, []);
    // TODO 彻底移除deepHide
    return (
        <mdui-tab-panel slot="panel" value="textFilter" className="h-[calc(100vh-5.3rem)] overflow-y-auto">
            <mdui-list>
                <mdui-list-subheader className="ml-5 font-bold">关键词列表({filterMode === "blacklist" ? "黑名单" : "白名单"}模式)</mdui-list-subheader>
                {
                    textFilter.map((text) =>
                        <mdui-list-item key={text} headline={text}>
                            <mdui-button-icon icon="close" slot="end-icon" onClick={() => {
                                ipc.editTextFilterRule("remove", text);
                                setTextFilter(state => state.filter(filterText => filterText !== text));
                                snackbar({
                                    message: "已删除",
                                    autoCloseDelay: 1000
                                })
                            }} />
                        </mdui-list-item>
                    )
                }
            </mdui-list>
            <div className="fixed bottom-3 right-18 flex flex-col">
                <mdui-fab icon="add" onClick={() => {
                    prompt({
                        headline: "添加关键词",
                        description: "将根据设置进行过滤",
                        confirmText: "添加",
                        cancelText: "取消",
                    }).then(value => {
                        const finalText = value.trimStart();
                        if (finalText === "") {
                            snackbar({
                                message: "请输入内容",
                                autoCloseDelay: 1000
                            });
                            return
                        }
                        if (textFilter.includes(finalText)) {
                            snackbar({
                                message: "该内容已存在",
                                autoCloseDelay: 1000
                            });
                            return
                        }
                        ipc.editTextFilterRule("add", finalText);
                        setTextFilter(state => [...state, finalText]);
                    }).catch(() => { });
                }} />
                <mdui-fab className="mt-5" icon="filter_list" onClick={() => setFilterMode(state => {
                    snackbar({
                        message: "已切换",
                        autoCloseDelay: 1000
                    })
                    return state === "blacklist" ? "whitelist" : "blacklist"
                })} />
            </div>
        </mdui-tab-panel>
    )
}
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
                <mdui-tab-panel slot="panel" value="appProfile">
                    profile
                </mdui-tab-panel>
            </mdui-tabs>
        </>
    )
}