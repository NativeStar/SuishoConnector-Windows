import { forwardRef, useEffect, useImperativeHandle, useMemo, useReducer, useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import NotificationItem from "./components/NotificationItem";
import type { NotificationItem as NotificationItemType } from "~/types/database";
import useDatabase from "~/hooks/useDatabase";
import { Virtuoso } from "react-virtuoso";
import { useFuzzySearchList } from "@nozbe/microfuzz/react";
import ItemFilterCard from "../../components/ItemFilterCard";
interface ButtonGroupProf {
    setShowFilterCard: React.Dispatch<React.SetStateAction<boolean>>
}
interface NotificationPageProps {
    hidden: boolean
}
interface NotificationPageRef {
    scrollToBottom(): void
}
export type NotificationListDispatch = [{
    type: "add" | "remove" | "set" | "clear",
    time?: number,
    notification?: NotificationItemType,
    initNotificationList?: NotificationItemType[],
}];
function ButtonGroup({ setShowFilterCard }: ButtonGroupProf) {
    return (
        <div className="mt-1">
            <mdui-tooltip content="搜索" placement="bottom">
                <mdui-button variant="text" onClick={() => setShowFilterCard(state => !state)}>
                    <mdui-icon name="search" />
                </mdui-button>
            </mdui-tooltip>
            <mdui-tooltip content="转发设置" placement="bottom">
                <mdui-button variant="text">
                    <mdui-icon name="filter_alt" />
                </mdui-button>
            </mdui-tooltip>
            <mdui-tooltip content="清空" placement="bottom">
                <mdui-button variant="text">
                    <mdui-icon name="delete_outline" />
                </mdui-button>
            </mdui-tooltip>
            <mdui-tooltip content="解锁" placement="bottom">
                <mdui-button variant="text">
                    <mdui-icon name="lock" />
                </mdui-button>
            </mdui-tooltip>
        </div>
    )
}
const NotificationPage = forwardRef<NotificationPageRef, NotificationPageProps>(({ hidden }, ref) => {
    useImperativeHandle(ref, () => ({
        scrollToBottom() {
            console.log("PlaceHolder");
        },
    }));
    const ipc = useMainWindowIpc();
    const db = useDatabase("notification");
    const [dataPath, setDataPath] = useState<string>("");
    const [showFilterCard, setShowFilterCard] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchIncludeAppName, setSearchIncludeAppName] = useState(false);
    const [notificationList, notificationDispatch] = useReducer<NotificationItemType[], NotificationListDispatch>((state, action) => {
        switch (action.type) {
            case "add":
                return [...state, action.notification!];
            case "set":
                return action.initNotificationList!;
            case "remove":
                return state.filter(item => item.timestamp == action.time);
            case "clear":
                return [];
        }
    }, []);
    const filteredList = useFuzzySearchList({
        list: notificationList,
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
            })
        })
        const notificationAppendListenerCleanup = ipc.on("notificationAppend", (notificationData) => {
            notificationDispatch({
                type: "add",
                notification: notificationData
            });
            db.addData(notificationData);
        });
        return () => {
            notificationAppendListenerCleanup();
        }
    }, []);
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
    }, [hidden])
    ipc.getDeviceDataPath().then(value => setDataPath(value));
    return (
        <div style={{ display: hidden ? "none" : "block" }} className="flex flex-col">
            <ButtonGroup setShowFilterCard={setShowFilterCard} />
            {showFilterCard && <ItemFilterCard className="mt-[2%]" setShowFilterCard={setShowFilterCard} setSearchText={setSearchText} extSwitchIcon="apps" extSwitchText="搜索包括应用名" extSwitchState={searchIncludeAppName} setExtSwitchState={setSearchIncludeAppName} />}
            {memoNotificationList.length===0 &&<div className="absolute left-5/12 top-5/12 text-[gray]">暂无数据</div>}
            <Virtuoso
                className="w-full"
                style={{ height: window.innerHeight * 0.85 }}
                data={memoNotificationList}
                atBottomThreshold={150}
                itemContent={(_index, item) => <NotificationItem dataPath={dataPath} notification={item} />}
            />
        </div>
    )
});
export default NotificationPage