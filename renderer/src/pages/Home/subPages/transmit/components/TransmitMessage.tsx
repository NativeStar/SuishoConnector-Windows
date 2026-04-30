import { twMerge } from "tailwind-merge";
import { confirm } from "mdui";
import type { TransmitFileMessage } from "~/types/database";
import { checkUrl, parseFileSize, isSupportedImageFormat, isWindowsExecutableFile } from "~/utils";
import "mdui/components/linear-progress"
import { useEffect, useRef, useState } from "react";
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
    setImagePreview: (url: string | null) => void
}
export function TextMessage({ text, from, createRightClickMenu, database, messageDispatch, timestamp, openUrl }: TextMessageProps) {
    const ipc = useMainWindowIpc();
    async function onContextMenuCallback(result: RightClickMenuItemId) {
        const selectedText = getSelection()?.toString();
        switch (result) {
            case RightClickMenuItemId.Copy:
                if (!selectedText || selectedText === "") {
                    await navigator.clipboard.writeText(text);
                    console.debug(`Copied transmit message:${text}`);
                } else {
                    await navigator.clipboard.writeText(selectedText);
                    //清空选择
                    getSelection()?.removeAllRanges();
                    console.debug(`Copied transmit message selected text:${selectedText}`);
                }
                break;
            case RightClickMenuItemId.Delete:
                if (await ipc.getDeviceConfig("deleteTransmitMessageConfirm", true)) {
                    confirm({
                        description: "删除该消息?",
                        confirmText: "删除",
                        cancelText: "取消",
                        closeOnOverlayClick: false,
                        onConfirm: () => {
                            database.deleteData(timestamp);
                            messageDispatch({
                                type: "remove",
                                timestamp: timestamp
                            });
                            console.debug(`Delete transmit text message:${timestamp}`);
                        }
                    })
                } else {
                    database.deleteData(timestamp);
                    messageDispatch({
                        type: "remove",
                        timestamp: timestamp
                    });
                    console.debug(`Delete transmit text message:${timestamp}`);
                }
                break
            case RightClickMenuItemId.OpenUrl:
                if (!selectedText || selectedText === "") {
                    openUrl(text);
                    console.debug(`Opened url from transmit message:${text}`);
                } else {
                    openUrl(selectedText);
                    console.debug(`Opened url from transmit message:${selectedText}`);
                }
                break
            case RightClickMenuItemId.Null:
                break
            default:
                console.warn(`Unknown transmit message menu result id:${result}`);
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
                createRightClickMenu(TransmitMessageMenuUrlText).then(onContextMenuCallback);
                console.debug("Transmit text message create has url menu");
                return
            }
            console.debug("Transmit text message create common menu");
            createRightClickMenu(TransmitMessageMenuCommonText).then(onContextMenuCallback)
        } else {
            //选中文本
            if (checkUrl(selectedText)) {
                createRightClickMenu(TransmitMessageMenuSelectedUrlText).then(onContextMenuCallback)
                console.debug("Transmit text message create has selection url menu");
                return
            }
            console.debug("Transmit text message create has selection text menu");
            createRightClickMenu(TransmitMessageMenuSelectedCommonText).then(onContextMenuCallback)
        }
    }
    return (
        <mdui-card onContextMenu={onContextMenu} className={twMerge("w-10/12 mt-1", from === "phone" ? "bg-[rgb(var(--mdui-color-surface-container-highest))]" : "bg-[rgb(var(--mdui-color-surface-container-low))] ml-28")} variant="filled">
            <div style={{ userSelect: "text" }} className="whitespace-normal wrap-break-word text-wrap pl-2 pt-0.5">
                {text}
            </div>
            <span className="pl-2 text-gray-400 text-xs">{new Date(timestamp).toLocaleString()}</span>
        </mdui-card>
    )
}
export function FileMessage({ data, progressing, database, messageDispatch, setImagePreview }: FileMessageProps) {
    const ipc = useMainWindowIpc();
    const [progressValue, setProgressValue] = useState<number>(0);
    const [isDeleted, setIsDeleted] = useState<boolean>(data.isDeleted);
    const [isError, setIsError] = useState<boolean>(false);
    const fileFullPathRef = useRef<string>(null);
    useEffect(() => {
        if (!data.isDeleted && data.from === "phone") {
            ipc.getTransmitFilePath(data.name).then(fullPath => {
                fileFullPathRef.current = `file://${fullPath}`;
            })
        }
    }, []);
    useEffect(() => {
        if (progressing) {
            const progressListener = (_event: never, progress: number) => {
                setProgressValue(progress);
            }
            ipc.registerFileUploadProgressListener(progressListener);
            const transmitFileUploadSuccessCleanup = ipc.on("transmitFileUploadSuccess", () => {
                //进度条消失之前填满
                setProgressValue(data.size);
                ipc.unregisterFileUploadProgressListener(progressListener);
                console.info(`Transmit file receive success:${data.name}`);
            });
            const transmitFileTransmitFailedCleanup = ipc.on("transmitFileTransmitFailed", () => {
                ipc.unregisterFileUploadProgressListener(progressListener);
                console.warn(`Transmit file receive failed:${data.name}`);
            })
            return () => {
                ipc.unregisterFileUploadProgressListener(progressListener);
                transmitFileUploadSuccessCleanup();
                transmitFileTransmitFailedCleanup();
                console.debug(`Unmount transmit file progress listener:${data.name}`);
            }
        }
    }, [progressing]);
    function setFileDeleted() {
        setIsDeleted(true);
        const modifiedData = { ...data, isDeleted: true }
        messageDispatch({
            type: "put",
            timestamp: modifiedData.timestamp,
            messageInstance: { ...data, isDeleted: true }
        });
        database.putData(modifiedData);
        console.debug(`Transmit file deleted:${data.timestamp}`);
    }
    function onContextMenu(event: React.MouseEvent<HTMLElement, MouseEvent>) {
        event.preventDefault();
        event.stopPropagation();
        const menu = structuredClone(TransmitMessageMenuFile);
        // 文件不存在 不允许资源管理器打开和联动删除文件
        if (data.isDeleted || data.from === "computer") {
            menu[0].enabled = false;
            menu[1].enabled = false;
        }
        ipc.createRightClickMenu(menu).then(async (result) => {
            switch (result) {
                case RightClickMenuItemId.Delete:
                    if (await ipc.getDeviceConfig("deleteTransmitMessageConfirm", true)) {
                        confirm({
                            description: "删除该消息?",
                            confirmText: "删除",
                            cancelText: "取消",
                            closeOnOverlayClick: false,
                            onConfirm: () => {
                                database.deleteData(data.timestamp);
                                messageDispatch({
                                    type: "remove",
                                    timestamp: data.timestamp
                                });
                                console.debug(`Delete transmit file message:${data.timestamp}`);
                            }
                        })
                    } else {
                        database.deleteData(data.timestamp);
                        messageDispatch({
                            type: "remove",
                            timestamp: data.timestamp
                        });
                        console.debug(`Delete transmit file message:${data.timestamp}`);
                    }
                    break
                case RightClickMenuItemId.OpenInExplorer:
                    console.debug(`Try open file in explorer`);
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
                            console.debug(`Transmit file deleted:${data.timestamp}`);
                        }
                    })
                    break
                case RightClickMenuItemId.DeleteWithFile:
                    if (await ipc.getDeviceConfig("deleteTransmitMessageConfirm", true)) {
                        confirm({
                            description: "确认删除该消息和对应文件?",
                            confirmText: "删除",
                            cancelText: "取消",
                            closeOnOverlayClick: false,
                            onConfirm: () => {
                                console.debug(`Delete transmit file and message:${data.timestamp}`);
                                ipc.deleteTransmitFile(data.name);
                                database.deleteData(data.timestamp);
                                messageDispatch({
                                    type: "remove",
                                    timestamp: data.timestamp
                                });
                            }
                        })
                    } else {
                        console.debug(`Delete transmit file and message:${data.timestamp}`);
                        ipc.deleteTransmitFile(data.name);
                        database.deleteData(data.timestamp);
                        messageDispatch({
                            type: "remove",
                            timestamp: data.timestamp
                        });
                    }
                    break
                default:
                    break;
            }
        })
    }
    function onDragStart(event: React.DragEvent<HTMLElement>) {
        event.preventDefault();
        ipc.startTransmitDragFile(data.name).then(result => {
            if (!result) setFileDeleted()
        })
        console.debug(`Start drag file message:${data.name}`);
    }
    async function openFile() {
        if (data.from === "computer" || data.isDeleted) return
        console.debug("Try open file");
        if (isWindowsExecutableFile(data.name)) {
            console.debug("Show open Windows executable file confirm");
            await confirm({
                headline: "打开文件警告",
                description: "即将打开的文件为Windows可执行或命令行文件 请确保其安全性\n是否确认打开?",
                confirmText: "打开",
                cancelText: "取消",
                onConfirm: () => {
                    ipc.openFile(data.name).then(result => {
                        if (!result) setFileDeleted()
                    })
                },
            }).catch(() => { });
            return
        }
        ipc.openFile(data.name).then(result => {
            if (!result) setFileDeleted()
        })
    }
    function onMediaError() {
        setIsError(true);
    }
    if (!progressing && data.from === "phone" && !data.isDeleted && fileFullPathRef.current !== null && isSupportedImageFormat(data.displayName)) {
        function openImagePreview() {
            setImagePreview(fileFullPathRef.current)
        }
        return (
            <div className="w-[36%] max-h-[15%] mt-1.5" onContextMenu={onContextMenu}>
                {
                    isError ?
                        <div className="w-full h-[20vh] flex flex-col justify-center items-center bg-[#ede7ed]">
                            <mdui-icon name="error_outline" className="size-12`"></mdui-icon>
                            <div className="text-[gray]">加载失败</div>
                        </div>
                        :
                        <img draggable src={fileFullPathRef.current} onDragEnd={()=>console.log("end drag")} onDragStart={onDragStart} onErrorCapture={onMediaError} className="draggable object-contain cursor-zoom-in" onClick={openImagePreview} />
                }
            </div>

        )
    }
    return (
        <mdui-card draggable={data.from === "phone" && !isDeleted} onDragStart={onDragStart} onContextMenu={onContextMenu} onClick={openFile} clickable={!isDeleted && data.from === "phone"} className={twMerge("draggable mdui-theme-auto w-65 h-23.5 rounded-[9px] mt-1 whitespace-pre-wrap text-ellipsis", data.from === "phone" ? "bg-[#ede7ed]" : "bg-[#f3ebf3] ml-110")} variant="elevated">
            <img src="./transmit_file_default.png" className="w-[32%] h-[85%] float-left mt-1.5" />
            <div className="flex flex-col" style={{ cursor: isDeleted || data.from === "computer" ? "default" : "pointer" }}>
                <b className="whitespace-nowrap text-ellipsis overflow-hidden mt-1.5 ml-15px" style={{ cursor: isDeleted || data.from === "computer" ? "default" : "pointer" }}>{data.displayName}</b>
                <div className={twMerge("mt-5", isDeleted ? "text-red-500" : "")} style={{ cursor: isDeleted || data.from === "computer" ? "default" : "pointer" }}>{isDeleted ? "文件被删除" : parseFileSize(data.size)}</div>
                {progressing && <mdui-linear-progress max={data.size} value={progressValue} className="mt-2 w-11/12" />}
                {/* 文件接收完毕后才显示时间 */}
                {!progressing && <span className="text-gray-400 text-xs">{new Date(data.timestamp).toLocaleString()}</span>}
            </div>
        </mdui-card>
    )
}