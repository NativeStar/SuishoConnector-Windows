import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import PathList from "./components/PathList";
import TooltipButton from "./components/TooltipButton";
import { useState } from "react";
import { alert, snackbar } from "mdui";
import type { FileSyncAppendEvent } from "~/types/ipc";
import SyncLogList from "./components/SyncLogList";

interface FileSyncPageProps {
    hidden: boolean;
}
export default function FileSyncPage({ hidden }: FileSyncPageProps) {
    const [watchingPathsList, setWatchingPathsList] = useState<string[]>([]);
    const [fileSyncList, setFileSyncList] = useState<FileSyncAppendEvent[]>([]);
    const ipc = useMainWindowIpc();
    async function onAddPathButtonClick() {
        const selectedPath = await ipc.showDirectoryPicker();
        if (!selectedPath) return
        console.debug(`Request add path to watching list:${selectedPath}`);
        const addWatchPathResult = await ipc.addWatchPath(selectedPath);
        if (addWatchPathResult) setWatchingPathsList(prev => [...prev, selectedPath]);
        console.debug(`Add path to watching list ${addWatchPathResult?"success":"fail"}`);
        snackbar({
            message: `添加${addWatchPathResult ? "成功" : "失败 请检查路径是否有访问权限获取其他异常 详见日志"}`,
            autoCloseDelay: addWatchPathResult ? 1500 : 3500
        });
    }
    return (
        <div style={{ display: hidden ? "none" : "block" }} className="flex mt-2">
            {/* 按钮 */}
            <div>
                <TooltipButton icon="add" tooltip="添加目录" onClick={onAddPathButtonClick} />
                <TooltipButton icon="delete" tooltip="清空记录" onClick={()=>{
                    setFileSyncList([]);
                    snackbar({
                        message: "已清理",
                        autoCloseDelay: 1500
                    });
                    console.debug("Clear synced file log");
                }}/>
                <TooltipButton icon="help_outline" tooltip="帮助" onClick={()=>{
                    alert({
                        headline:"帮助",
                        description:"由于系统限制 该功能仅建议用于传输非流式写入的中小文件(如屏幕截图)\nAndroid端接收文件夹位于'内部存储/Download/SuishoConnector/FileSync'\n或'应用私有目录/FileSync'\n(根据设置的设备互传接收文件夹而定)",
                        confirmText:"确定"
                    })
                }}/>
            </div>
            <div className="flex">
                <PathList paths={watchingPathsList} setPaths={setWatchingPathsList} />
                <SyncLogList logs={fileSyncList} setLogs={setFileSyncList}/>
            </div>
        </div>
    )
}