import { useEffect, useState } from "react";
import { RightClickMenuItemId } from "shared/const/RightClickMenuItems";
import { twMerge } from "tailwind-merge";
import type useDatabase from "~/hooks/useDatabase";
import useTextTruncated from "~/hooks/useTextTruncated"
import { NotificationItemNotSelectedText, TransmitMessageMenuSelectedCommonText } from "~/types/contextMenus";
import type { NotificationItem } from "~/types/database";
import type { NotificationListDispatch } from "../NotificationPage";

interface NotificationItemProps {
    dataPath: string,
    notification: NotificationItem,
    createRightClickMenu: typeof window.electronMainProcess.createRightClickMenu
    db: ReturnType<typeof useDatabase<"notification">>,
    notificationDispatch: React.ActionDispatch<NotificationListDispatch>,
    openNotificationForwardConfigWindow:typeof window.electronMainProcess.openNotificationForwardConfigWindow
}
export default function NotificationItem({ dataPath, notification, createRightClickMenu, db, notificationDispatch ,openNotificationForwardConfigWindow}: NotificationItemProps) {
    function onContextMenu() {
        const selectedText = getSelection()?.toString() ?? "";
        createRightClickMenu(selectedText === "" ? NotificationItemNotSelectedText : TransmitMessageMenuSelectedCommonText).then(result => {
            switch (result) {
                case RightClickMenuItemId.Null:
                    break
                case RightClickMenuItemId.Copy:
                    navigator.clipboard.writeText(selectedText).then(() => {
                        getSelection()?.removeAllRanges();
                    });
                    console.debug(`Copied notification selected text:${selectedText}`);
                    break;
                case RightClickMenuItemId.CopyTitle:
                    navigator.clipboard.writeText(notification.title);
                    console.debug(`Copied notification title:${notification.title}`);
                    break
                case RightClickMenuItemId.CopyContent:
                    navigator.clipboard.writeText(notification.content);
                    console.debug(`Copied notification content:${notification.content}`);
                    break
                case RightClickMenuItemId.Delete:
                    db.deleteData(notification.timestamp);
                    notificationDispatch({
                        type: "remove",
                        time: notification.timestamp
                    })
                    console.debug(`Deleted notification:${notification.timestamp}`);
                    break
                case RightClickMenuItemId.OpenNotificationApplicationPanel:
                    openNotificationForwardConfigWindow(notification.packageName,notification.appName)
                    console.debug(`Opened notification application panel:${notification.packageName}`);
                    break
                default:
                    console.warn(`Unsupported notification menu type:${result}`);
                    break;
            }
        })
    }
    const [defaultIsOverflow, contentRef] = useTextTruncated(0);
    const [spread, setSpread] = useState<boolean>(false);
    useEffect(() => {
        if (defaultIsOverflow) {
            contentRef.current!.className = twMerge("selectable wrap-break-word block max-w-full", spread ? "" : "truncate")
        }
    }, [defaultIsOverflow, spread]);
    return (
        <mdui-card clickable className="flex w-[98.5%] cursor-default" onContextMenu={onContextMenu}>
            <img src={`${dataPath}assets/iconCache/${notification.packageName}`} className="w-5 h-5 ml-1.5 mt-0.5" onError={(e) => {
                // 替换统一图标
                (e.target as HTMLImageElement).src = "/app_icon_unknown.png"
            }} />
            <div className="flex flex-col ml-1.5 overflow-hidden">
                <small className="whitespace-nowrap max-w-[99.6%]">{notification.appName}</small>
                <b className="whitespace-nowrap max-w-[99.6%] selectable">{notification.title}</b>
                <div ref={contentRef} className="selectable wrap-break-word block max-w-full truncate">{notification.content}</div>
            </div>
            {defaultIsOverflow && <mdui-button-icon className="ml-auto mr-1.5" icon={spread ? "arrow_circle_up" : "arrow_circle_down"} onClick={() => {
                setSpread(!spread)
            }} />}
        </mdui-card>
    )
}