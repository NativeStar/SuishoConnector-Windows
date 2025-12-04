import { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import NotificationItem from "./components/NotificationItem";
import type { NotificationItem as NotificationItemType } from "~/types/database";
import useDatabase from "~/hooks/useDatabase";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useFuzzySearchList } from "@nozbe/microfuzz/react";
import ItemFilterCard from "../../components/ItemFilterCard";
import { confirm, snackbar } from "mdui";
import AndroidIdContext from "~/context/AndroidIdContext";
import { initHideNotificationCache, needHideNotification, openPasswordInputDialog } from "~/utils";
interface ButtonGroupProf {
    setShowFilterCard: React.Dispatch<React.SetStateAction<boolean>>,
    protectType: NotificationProtectInternalType,
    setCurrentProtectState: React.Dispatch<React.SetStateAction<NotificationProtectInternalType>>,
    db: ReturnType<typeof useDatabase<"notification">>,
    notificationListDispatch: React.ActionDispatch<NotificationListDispatch>
}
interface NotificationPageProps {
    hidden: boolean,
    setHasNewNotification: React.Dispatch<React.SetStateAction<boolean>>
}
export interface NotificationPageRef {
    scrollToBottom(): void
}
type NotificationProtectInternalType = "disabled" | "protected" | "unlocked" | "fullUnlocked";
export type NotificationListDispatch = [{
    type: "add" | "remove" | "set" | "clear",
    time?: number,
    notification?: NotificationItemType,
    initNotificationList?: NotificationItemType[],
}];
function ButtonGroup({ setShowFilterCard, protectType, setCurrentProtectState, db, notificationListDispatch }: ButtonGroupProf) {
    const ipc = useMainWindowIpc();
    const [unlockButtonLoading, setUnlockButtonLoading] = useState(false);
    const { androidId } = useContext(AndroidIdContext);
    async function onUnlockButtonClick(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        if (event.button !== 0 && event.button !== 2) return
        const fullUnlock=event.button === 2;
        const protectNotificationForwardPage = await ipc.getDeviceConfig("protectNotificationForwardPage") as boolean;
        //没开启功能
        if (!protectNotificationForwardPage) {
            setCurrentProtectState("fullUnlocked");
            snackbar({
                message: "未开启保护",
                autoCloseDelay: 1000
            });
            return
        }
        //锁定
        if (protectType === "unlocked"||protectType === "fullUnlocked") {
            // 只有左键能锁定
            if (event.button===0) {
                setCurrentProtectState("protected");
            }
            return
        }
        //解锁
        const protectMethod: string | null = await ipc.getDeviceConfig("protectMethod") as string | null;
        if (protectMethod === "oauth") {
            setUnlockButtonLoading(true);
            ipc.startAuthorization().then(result => {
                result && setCurrentProtectState(fullUnlock?"fullUnlocked":"unlocked");
                snackbar({
                    message: result ? "已解锁" : "验证失败",
                    autoCloseDelay: 1250
                });
            }).catch(e => {
                console.error(e);
            }).finally(() => {
                setUnlockButtonLoading(false);
            });
        } else if (protectMethod === "password") {
            openPasswordInputDialog("请输入密码", androidId).then(result => {
                result && setCurrentProtectState(fullUnlock?"fullUnlocked":"unlocked");
                snackbar({
                    message: result ? "已解锁" : "验证失败",
                    autoCloseDelay: 1250
                });
            })
        } else {
            console.warn(`Unknown protect method:${protectMethod}`);
        }
    }
    function onClearButtonClick() {
        confirm({
            headline: "清空通知记录",
            description: "确认清空通知记录?",
            confirmText: "确认",
            cancelText: "取消",
            onConfirm: async () => {
                await db.clearData();
                notificationListDispatch({
                    type: "clear"
                });
                snackbar({
                    message: "删除成功",
                    autoCloseDelay: 1750
                });
            }
        }).catch(() => { });
    }
    return (
        <div className="mt-1">
            <mdui-tooltip content="搜索" placement="bottom">
                <mdui-button disabled={protectType === "protected"} variant="text" onClick={() => setShowFilterCard(state => !state)}>
                    <mdui-icon name="search" />
                </mdui-button>
            </mdui-tooltip>
            <mdui-tooltip content="转发设置" placement="bottom">
                <mdui-button disabled={protectType === "protected"} variant="text" onClick={() => ipc.openNotificationForwardConfigWindow()}>
                    <mdui-icon name="filter_alt" />
                </mdui-button>
            </mdui-tooltip>
            <mdui-tooltip content="清空" placement="bottom">
                <mdui-button onClick={onClearButtonClick} disabled={protectType === "protected"} variant="text">
                    <mdui-icon name="delete_outline" />
                </mdui-button>
            </mdui-tooltip>
            <mdui-tooltip content="解锁" placement="bottom">
                <mdui-button onMouseDown={onUnlockButtonClick} loading={unlockButtonLoading} variant="text">
                    <mdui-icon name="lock" />
                </mdui-button>
            </mdui-tooltip>
        </div>
    )
}
const NotificationPage = forwardRef<NotificationPageRef, NotificationPageProps>(({ hidden, setHasNewNotification }, ref) => {
    useImperativeHandle(ref, () => ({
        scrollToBottom() {
            listRef.current?.scrollToIndex({
                index: "LAST",
                align: "end",
                behavior: "auto"
            });
        },
    }));
    const ipc = useMainWindowIpc();
    const db = useDatabase("notification");
    const [dataPath, setDataPath] = useState<string>("");
    const [showFilterCard, setShowFilterCard] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchIncludeAppName, setSearchIncludeAppName] = useState(false);
    const [currentProtectState, setCurrentProtectState] = useState<NotificationProtectInternalType>("disabled");
    const listRef = useRef<VirtuosoHandle>(null);
    const isAtBottom = useRef(true);
    const [notificationList, notificationDispatch] = useReducer<NotificationItemType[], NotificationListDispatch>((state, action) => {
        switch (action.type) {
            case "add":
                if (!isAtBottom.current) {
                    setHasNewNotification(true);
                }
                return [...state, action.notification!];
            case "set":
                return action.initNotificationList!;
            case "remove":
                return state.filter(item => item.timestamp !== action.time);
            case "clear":
                return [];
        }
    }, []);
    const filteredList = useFuzzySearchList({
        // 深度隐藏
        list: notificationList.filter((item) => currentProtectState==="fullUnlocked"?true:!needHideNotification(item.packageName)),
        strategy: "off",
        mapResultItem: ({ item }) => item,
        queryText: searchText,
        getText(item) {
            return [item.title, item.content, searchIncludeAppName ? item.appName : null];
        }
    });
    const memoNotificationList = useMemo(() => filteredList, [filteredList]);
    // 初始化
    useEffect(() => {
        db.getAllData().then(data => {
            notificationDispatch({
                type: "set",
                initNotificationList: data
            });
            listRef.current?.scrollToIndex(data.length - 1);
        });
        const notificationAppendListenerCleanup = ipc.on("notificationAppend", (notificationData) => {
            notificationDispatch({
                type: "add",
                notification: notificationData
            });
            db.addData(notificationData);
        });
        ipc.getDeviceConfig("protectNotificationForwardPage").then((value) => {
            setCurrentProtectState((value as boolean) ? "protected" : "disabled");
            // 只在开启保护时初始化缓存 毕竟不是所有人都要开这个功能
            if (value) {
                // 避免在初始化之前执行导致拿到空数据
                db.getAllData().then(data => initHideNotificationCache(ipc.getNotificationProfile, data))
            }
        });
        return () => {
            notificationAppendListenerCleanup();
        }
    }, []);
    // 当搜索内容变化时拖到底部
    useEffect(() => {
        listRef.current?.scrollToIndex({
            index: "LAST",
            align: "end",
            behavior: "auto"
        });
    }, [searchText]);
    // 事件监听等
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!hidden) {
                if (event.ctrlKey && event.key.toUpperCase() === "F") {
                    setShowFilterCard(state => !state);
                }
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [hidden]);
    useEffect(() => {
        if (currentProtectState === "unlocked" || currentProtectState === "fullUnlocked") {
            listRef.current?.scrollToIndex(memoNotificationList.length - 1);
        }
    }, [currentProtectState]);
    ipc.getDeviceDataPath().then(value => setDataPath(value));
    return (
        <div style={{ display: hidden ? "none" : "block" }} className="flex flex-col">
            <ButtonGroup setShowFilterCard={setShowFilterCard} protectType={currentProtectState} setCurrentProtectState={setCurrentProtectState} db={db} notificationListDispatch={notificationDispatch} />
            {showFilterCard && <ItemFilterCard className="mt-[2%]" setShowFilterCard={setShowFilterCard} setSearchText={setSearchText} extSwitchIcon="apps" extSwitchText="搜索包括应用名" extSwitchState={searchIncludeAppName} setExtSwitchState={setSearchIncludeAppName} />}
            {memoNotificationList.length === 0 && <div className="absolute left-5/12 top-5/12 text-[gray]">暂无数据</div>}
            {currentProtectState === "protected" ?
                <div className="fixed rounded-2xl notificationForwardProtectMark h-[84.5%] w-[89.5%] text-center text-[gray] pt-[26%]">
                    通知记录已锁定
                    <br />
                    点击
                    <mdui-icon name="lock_open"></mdui-icon>
                    按钮验证后可查看
                </div>
                :
                <Virtuoso
                    ref={listRef}
                    className="w-full"
                    style={{ height: window.innerHeight * 0.85 }}
                    data={memoNotificationList}
                    atBottomThreshold={150}
                    followOutput="smooth"
                    defaultItemHeight={67.2}
                    atBottomStateChange={(atBottom) => {
                        isAtBottom.current = atBottom;
                        if (atBottom) {
                            setHasNewNotification(false);
                        }
                    }}
                    itemContent={(_index, item) => (
                        <div className="py-0.5">
                            <NotificationItem dataPath={dataPath} notification={item} createRightClickMenu={ipc.createRightClickMenu} db={db} notificationDispatch={notificationDispatch} openNotificationForwardConfigWindow={ipc.openNotificationForwardConfigWindow} />
                        </div>
                    )}
                />}
        </div>
    )
});
export default NotificationPage