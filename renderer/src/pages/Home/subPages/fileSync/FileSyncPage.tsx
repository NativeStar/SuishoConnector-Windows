import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import PathList from "./components/PathList";
import TooltipButton from "./components/TooltipButton";
import { useState } from "react";
import { snackbar } from "mdui";

interface FileSyncPageProps {
    hidden: boolean;
}
export default function FileSyncPage({ hidden }: FileSyncPageProps) {
    const [watchingPathsList, setWatchingPathsList] = useState<string[]>([]);

    const ipc = useMainWindowIpc();
    async function onAddPathButtonClick() {
        const selectedPath = await ipc.showDirectoryPicker();
        if (!selectedPath) return
        const addWatchPathResult = await ipc.addWatchPath(selectedPath);
        if (addWatchPathResult) setWatchingPathsList(prev => [...prev, selectedPath]);
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
                <TooltipButton icon="delete" tooltip="清空记录" />
            </div>
            <PathList paths={watchingPathsList} setPaths={setWatchingPathsList} />
        </div>

    )
}