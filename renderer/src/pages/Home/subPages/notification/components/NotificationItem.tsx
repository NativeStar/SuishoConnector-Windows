import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import useTextTruncated from "~/hooks/useTextTruncated"
import type { NotificationItem } from "~/types/database";

interface NotificationItemProps {
    dataPath: string,
    notification: NotificationItem
}
export default function NotificationItem({ dataPath, notification }: NotificationItemProps) {
    const [defaultIsOverflow, contentRef] = useTextTruncated(0);
    const [spread, setSpread] = useState<boolean>(false);
    useEffect(() => {
        if (defaultIsOverflow) {
            contentRef.current!.className = twMerge("selectable wrap-break-word block max-w-full", spread ? "" : "truncate")
        }
    }, [defaultIsOverflow, spread]);
    return (
        <mdui-card clickable className="flex w-[98.5%] mt-1.5 cursor-default">
            <img src={`${dataPath}assets/iconCache/${notification.packageName}`} className="w-5 h-5 ml-1.5 mt-0.5" onError={() => { console.log("error handle todo") }} />
            <div className="flex flex-col ml-1.5 overflow-hidden">
                <small className="whitespace-nowrap max-w-[99.6%]">{notification.appName}</small>
                <b className="whitespace-nowrap max-w-[99.6%] selectable">{notification.title}</b>
                <div ref={contentRef} className="selectable wrap-break-word block max-w-full truncate">{notification.content}</div>
            </div>
            {defaultIsOverflow && <mdui-button-icon className="ml-auto mr-1.5" icon={spread ? "arrow_circle_down" : "arrow_circle_up"} onClick={() => {
                setSpread(!spread)
            }} />}
        </mdui-card>
    )
}