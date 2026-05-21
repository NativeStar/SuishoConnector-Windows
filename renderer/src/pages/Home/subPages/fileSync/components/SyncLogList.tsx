import { useEffect } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import type { FileSyncAppendEvent } from "~/types/ipc"

interface SyncLogListProps {
    logs: FileSyncAppendEvent[]
    setLogs: React.Dispatch<React.SetStateAction<FileSyncAppendEvent[]>>
}
interface SyncLogItemProps {
    event: FileSyncAppendEvent
}
const FileStateText={
    "append":"等待同步",
    "error":"发生异常",
    "success":"已同步"
} as const;
function SyncLogItem({ event }: SyncLogItemProps) {
    return (
        <mdui-tooltip>
            <span className="whitespace-normal wrap-anywhere break-all" slot="content">来自路径:{event.path}</span>
            <mdui-list-item className="whitespace-normal wrap-anywhere break-all" headline={event.fileName} headline-line={1} description={FileStateText[event.state]}></mdui-list-item>
        </mdui-tooltip>
    )
}
export default function SyncLogList({ logs, setLogs }: SyncLogListProps) {
    const ipc = useMainWindowIpc();
    useEffect(() => {
        const fileAppendListenerCleanup=ipc.on("appendFileSyncList", data => {
            switch (data.state) {
                case "append":
                    setLogs(logs => [...logs, data])
                    console.debug(`Append new file sync log:${data.path}`);
                    break;
                case "error":
                    //修改指定项的state
                    setLogs(logs => logs.map(item => item.id === data.id ? { ...item, state: "error" } : item))
                    console.info(`File sync error:${data.path}`);
                    break
                case "success":
                    setLogs(logs => logs.map(item => item.id === data.id ? { ...item, state: "success" } : item))
                    console.info(`File sync success:${data.path}`);
                    break
                default:
                    console.warn(`Unknown file sync state:${data.state}`);
            }
        });
        return ()=>{
            fileAppendListenerCleanup()
        }
    }, [])
    return (
        <mdui-list className="w-full">
            <mdui-list-subheader>同步记录(仅显示本次启动时数据)</mdui-list-subheader>
            <div className="smallScrollBar overflow-y-auto max-h-[calc(100vh-9.4rem)]">
                {logs.length === 0 && <span className="text-[gray] absolute right-58">暂无同步记录</span>}
                {logs.map(log => <SyncLogItem event={log} key={log.id}/>)}
            </div>
        </mdui-list>
    )
}