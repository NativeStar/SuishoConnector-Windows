import { twMerge } from "tailwind-merge";
import type { TransmitFileMessage } from "~/types/database";
import { checkUrl, parseFileSize } from "~/utils";
import "mdui/components/linear-progress"
import { useEffect, useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import type useDatabase from "~/hooks/useDatabase";
import type { TransmitMessageListDispatch } from "../TransmitPage";
import { TransmitMessageMenuCommonText, TransmitMessageMenuUrlText, TransmitMessageMenuSelectedCommonText, TransmitMessageMenuSelectedUrlText, TransmitMessageMenuFile } from "~/types/contextMenus";
import { RightClickMenuItemId } from "shared/const/RightClickMenuItems";
interface TextMessageProps {
    // 文本对ipc的需求少且消息数量可能更多 直接把函数传进来吧
    text: string,
    from: "phone" | "computer",
    database: ReturnType<typeof useDatabase<"transmit">>,
    messageDispatch: React.ActionDispatch<TransmitMessageListDispatch>,
    createRightClickMenu: typeof window.electronMainProcess.createRightClickMenu,
    timestamp: number,
    openUrl: typeof window.electronMainProcess.openUrl
}
interface FileMessageProps {
    data: TransmitFileMessage,
    progressing: boolean,
    database: ReturnType<typeof useDatabase<"transmit">>,
    messageDispatch: React.ActionDispatch<TransmitMessageListDispatch>,
}
export function TextMessage({ text, from, createRightClickMenu, database, messageDispatch, timestamp, openUrl }: TextMessageProps) {
    async function onContextMenuCallback(result: RightClickMenuItemId) {
        const selectedText = getSelection()?.toString();
        switch (result) {
            case RightClickMenuItemId.Copy:
                if (!selectedText || selectedText === "") {
                    await navigator.clipboard.writeText(text);
                    //清空选择
                } else {
                    await navigator.clipboard.writeText(selectedText);
                    getSelection()?.removeAllRanges();
                }
                break;
            case RightClickMenuItemId.Delete:
                database.deleteData(timestamp);
                messageDispatch({
                    type: "remove",
                    timestamp: timestamp
                });
                break
            case RightClickMenuItemId.OpenUrl:
                if (!selectedText || selectedText === "") {
                    openUrl(text);
                } else {
                    openUrl(selectedText);
                }
                break
            case RightClickMenuItemId.Null:
                break
            default:
                console.warn(`Unknown result id:${result}`);
                break;
        }
    }
    function onContextMenu(event: React.MouseEvent<HTMLElement, MouseEvent>) {
        event.preventDefault();
        event.stopPropagation();
        const selectedText = getSelection()?.toString();
        if (!selectedText || selectedText === "") {
            //未选择文本
            if (checkUrl(text)) {
                //含有url
                createRightClickMenu(TransmitMessageMenuUrlText).then(onContextMenuCallback)
                return
            }
            createRightClickMenu(TransmitMessageMenuCommonText).then(onContextMenuCallback)
        } else {
            //选中文本
            if (checkUrl(selectedText)) {
                createRightClickMenu(TransmitMessageMenuSelectedUrlText).then(onContextMenuCallback)
                return
            }
            createRightClickMenu(TransmitMessageMenuSelectedCommonText).then(onContextMenuCallback)
        }
    }
    return (
        <mdui-card onContextMenu={onContextMenu} className={twMerge("w-10/12 mt-1", from === "phone" ? "bg-[#ede7ed]" : "bg-[#f3ebf3] ml-28")} variant="filled">
            <div style={{ userSelect: "text" }} className="whitespace-normal wrap-break-word text-wrap pl-2 pt-0.5 pb-0.5">
                {text}
            </div>
        </mdui-card>
    )
}
export function FileMessage({ data, progressing: hasProgress, database, messageDispatch }: FileMessageProps) {
    const ipc = useMainWindowIpc();
    const [progressValue, setProgressValue] = useState<number>(0);
    const [progressing, setProgressing] = useState<boolean>(hasProgress);
    const [isDeleted, setIsDeleted] = useState<boolean>(data.isDeleted);
    useEffect(() => {
        const progressListener = (_event: never, progress: number) => {
            setProgressValue(progress);
        }
        if (hasProgress) {
            ipc.registerFileUploadProgressListener(progressListener);
            ipc.on("transmit_fileUploadSuccess", () => {
                //进度条消失之前填满
                setProgressValue(data.size);
                setProgressing(false);
                ipc.unregisterFileUploadProgressListener(progressListener);
            });
            ipc.on("transmit_fileTransmitFailed", () => {
                setProgressing(false);
                ipc.unregisterFileUploadProgressListener(progressListener);
            })
            return () => {
                ipc.unregisterFileUploadProgressListener(progressListener);
            }
        }
    }, []);
    function onContextMenu(event: React.MouseEvent<HTMLElement, MouseEvent>) {
        event.preventDefault();
        event.stopPropagation();
        const menu = structuredClone(TransmitMessageMenuFile);
        // 文件不存在 不允许资源管理器打开
        if (data.isDeleted || data.from === "computer") {
            menu[0].enabled = false;
        }
        ipc.createRightClickMenu(menu).then(result => {
            if (result === RightClickMenuItemId.Delete) {
                database.deleteData(data.timestamp);
                messageDispatch({
                    type: "remove",
                    timestamp: data.timestamp
                });
            } else if (result === RightClickMenuItemId.OpenInExplorer) {
                ipc.openInExplorer("transmitFile", data.name).then(result => {
                    if (!result) {
                        // 文件不存在
                        setIsDeleted(true);
                        const modifiedData = { ...data, isDeleted: true }
                        messageDispatch({
                            type: "put",
                            timestamp: modifiedData.timestamp,
                            messageInstance: { ...data, isDeleted: true }
                        });
                        database.putData(modifiedData);
                    }
                })
            }
        })
    }
    function openFile() {
        if (data.from === "computer") return
        ipc.openFile(data.name).then(result => {
            if (!result) {
                setIsDeleted(true);
                const modifiedData = { ...data, isDeleted: true }
                messageDispatch({
                    type: "put",
                    timestamp: modifiedData.timestamp,
                    messageInstance: { ...data, isDeleted: true }
                });
                database.putData(modifiedData);
            }
        })
    }
    return (
        <mdui-card onContextMenu={onContextMenu} onClick={openFile} clickable={!isDeleted && data.from === "phone"} className={twMerge("mdui-theme-auto w-65 h-23.5 rounded-[9px] mt-1 whitespace-pre-wrap text-ellipsis", data.from === "phone" ? "bg-[#ede7ed]" : "bg-[#f3ebf3] ml-110")} variant="elevated">
            <img src="/transmit_file_default.png" className="w-[32%] h-[85%] float-left mt-1.5" />
            <div className="flex flex-col" style={{ cursor: isDeleted || data.from === "computer" ? "default" : "pointer" }}>
                <b className="whitespace-nowrap text-ellipsis overflow-hidden mt-1.5 ml-15px" style={{ cursor: isDeleted || data.from === "computer" ? "default" : "pointer" }}>{data.displayName}</b>
                <div className={twMerge("mt-5", isDeleted ? "text-red-500" : "")} style={{ cursor: isDeleted || data.from === "computer" ? "default" : "pointer" }}>{isDeleted ? "文件被删除" : parseFileSize(data.size)}</div>
                {progressing && <mdui-linear-progress max={data.size} value={progressValue} className="mt-2 w-11/12" />}
            </div>
        </mdui-card>
    )
}