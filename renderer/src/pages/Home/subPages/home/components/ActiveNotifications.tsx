import { useEffect, useReducer, useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import useTextTruncated from "~/hooks/useTextTruncated";
import { twMerge } from "tailwind-merge";
import "mdui/components/divider";
interface ActiveNotificationCardProp {
    notification: ActiveNotification,
    dataPath: string
    onClose: (key: string) => void
}
interface ActiveNotificationListProp {
    className?: string
}
interface ActiveNotification {
    packageName: string,
    title: string,
    content: string,
    appName: string,
    key: string,
    isOngoing: boolean,
    progress: number
}
type ActiveNotificationReducerAction = [{
    type: "add" | "remove" | "set" | "clear",
    key?: string,
    notification?: ActiveNotification,
    initNotificationList?: ActiveNotification[]
}];
const ActiveNotificationResultCode={
    NORMAL:0,
    UNTRUSTED:1,
    NOT_PERMiSSION:2,
    FUNCTION_DISABLED:3
} as const;
function ActiveNotificationCard({ notification, dataPath, onClose }: ActiveNotificationCardProp) {
    const [defaultIsOverflow, contentRef] = useTextTruncated(-10);
    const [spread, setSpread] = useState<boolean>(false);
    useEffect(() => {
        if (defaultIsOverflow) {
            contentRef.current!.className = twMerge("block ml-0.5 text-sm max-w-[99.6%]", spread ? "" : "truncate")
        }
    }, [spread])
    return (
        <mdui-card className="flex mt-1 mb-0.5 ml-1.5 pb-0.5 min-w-[98%] max-w-[98%]">
            <img className="w-5 h-5 mt-0.5 ml-0.5" src={`${dataPath}assets/iconCache/${notification.packageName}`} />
            <div className="relative flex flex-col flex-1 select-none overflow-hidden">
                <small className="block ml-0.5 mt-0.5 max-w-[99.6%] text-xs">{notification.appName}</small>
                <b className="block ml-0.5 truncate max-w-[99.6%]">{notification.title}</b>
                <div ref={contentRef} className={twMerge("block ml-0.5 text-sm max-w-[99.6%] truncate")}>{notification.content}</div>
                {notification.progress > 0 && <mdui-linear-progress max={100} value={notification.progress} className="mt-2 w-11/12" />}
            </div>
            {defaultIsOverflow && <mdui-icon name={spread ? "keyboard_arrow_up" : "keyboard_arrow_down"} onClick={() => {
                setSpread(!spread)
            }} />}
            {!notification.isOngoing && <mdui-icon name="close" className="absolute right-0" onClick={() => onClose(notification.key)} />}
        </mdui-card>
    )
}
export default function ActiveNotifications({ className }: ActiveNotificationListProp) {
    function updateNotification() {
        ipc.sendRequestPacket<{ list: ActiveNotification[], code: number}>({ packetType: "main_getCurrentNotificationsList" }).then(value => {
            switch (value.code) {
                case ActiveNotificationResultCode.NORMAL:
                    setTipText("");
                    activeNotificationDispatch({ type: "set", initNotificationList: value.list });
                    break
                case ActiveNotificationResultCode.NOT_PERMiSSION:
                    setTipText("需要授予通知读取权限");
                    break
                case ActiveNotificationResultCode.UNTRUSTED:
                    setTipText("计算机不被信任")
                    break
                case ActiveNotificationResultCode.FUNCTION_DISABLED:
                    setTipText("通知转发被禁用");
                    break

            }
            setEnableInteraction(true);
        })
    }
    const ipc = useMainWindowIpc();
    const [dataPath, setDataPath] = useState<string>("");
    ipc.getDeviceDataPath().then(value => setDataPath(value));
    const [activeNotification, activeNotificationDispatch] = useReducer<ActiveNotification[], ActiveNotificationReducerAction>((state, action) => {
        switch (action.type) {
            case "add":
                const next = action!.notification as ActiveNotification;
                const index = state.findIndex(item => item.key === next.key);
                if (index === -1) {
                    return [...state, next];
                }
                const clone = [...state];
                clone[index] = next; // 用最新内容覆盖
                console.debug(`Append new active notification:${JSON.stringify(next)}`);
                return clone;
            case "remove":
                console.debug(`Remove a active notification with key:${action.key}`);
                return state.filter(value => value.key !== action.key)
            case "set":
                const deduped = new Map(
                    (action.initNotificationList ?? []).map(item => [item.key, item])
                );
                console.debug(`Set active notification list:${JSON.stringify(action.initNotificationList)}`);
                return Array.from(deduped.values());
            case "clear":
                console.debug(`Clear active notification list`);
                return [];
        }
    }, []);
    const [enableInteraction, setEnableInteraction] = useState<boolean>(true);
    const [tipText, setTipText] = useState<string>("");
    // 初始化
    useEffect(() => {
        setTimeout(() => {
            updateNotification();
        }, 1500);
        const updateNotificationCleanup = ipc.on("currentNotificationUpdate", data => {
            //点击通知导致的移除无title content属性
            if (data.type === "remove") {
                activeNotificationDispatch({ type: "remove", key: data.key });
                return
            }
            if (!data.title && !data.content) {
                return
            }
            activeNotificationDispatch({
                type: data.type,
                key: data.key,
                notification: {
                    appName: data.appName,
                    content: data.content,
                    isOngoing: data.ongoing,
                    key: data.key,
                    packageName: data.packageName,
                    title: data.title,
                    progress: data.progress
                }
            })
        });
        return () => {
            updateNotificationCleanup();
        }
    }, []);
    return (
        <mdui-card className={twMerge("fixed h-[45%] flex flex-col max-w-[40%] min-w-[40%]", className)}>
            <div className="flex items-center px-2 py-1">
                <small className="text-[gray]">通知列表</small>
                <div className="ml-auto flex items-center text-[gray]">
                    {/* 刷新按钮 */}
                    <mdui-icon hidden={!enableInteraction} name="refresh" className="cursor-pointer ml-1" onClick={() => {
                        setEnableInteraction(false);
                        activeNotificationDispatch({ type: "clear" });
                        updateNotification();
                    }}
                    />
                    {/* 清空按钮 */}
                    <mdui-icon hidden={!enableInteraction} name="clear_all" className="cursor-pointer ml-1" onClick={() => {
                        setEnableInteraction(false);
                        activeNotificationDispatch({ type: "clear" });
                        ipc.sendPacket({ packetType: "removeCurrentNotification", key: "all" });
                        updateNotification();
                    }}
                    />
                </div>
            </div>
            <mdui-divider />
            <div className="flex-1 overflow-hidden">
                {tipText!==""&& <div className="text-center text-[gray]">{tipText}</div>}
                {tipText!==""&&<div className="text-center text-[gray]">请在手机上修改相关设置后点击刷新按钮</div>}
                <div className="h-full overflow-y-scroll pr-1 activeNotificationsList">
                    {
                        activeNotification.map(value => (
                            <ActiveNotificationCard key={value.key} dataPath={dataPath} notification={value} onClose={key => {
                                ipc.sendPacket({ packetType: "removeCurrentNotification", key: key });
                                activeNotificationDispatch({ type: "remove", key: key })
                            }} />
                        ))
                    }
                </div>
            </div>
        </mdui-card>
    )
}