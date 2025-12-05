import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { alert, confirm, snackbar } from "mdui";
import TransmitTextInputArea from "./components/TransmitTextInputArea";
import { forwardRef, useImperativeHandle, useEffect, useMemo, useReducer, useRef, useState } from "react";
import useDatabase from "~/hooks/useDatabase";
import type { TransmitFileMessage, TransmitTextMessage } from "~/types/database";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import { FileMessage, TextMessage } from "./components/TransmitMessage";
import { TransmitMessageListMenu } from "~/types/contextMenus";
import { RightClickMenuItemId } from "shared/const/RightClickMenuItems";
import DragFileMark from "./components/DragFileMark";
import { useFuzzySearchList } from "@nozbe/microfuzz/react"
import ItemFilterCard from "../../components/ItemFilterCard";

interface TransmitPageProps {
    hidden: boolean,
    setHasNewTransmitMessage: React.Dispatch<React.SetStateAction<boolean>>
}

export interface TransmitPageRef {
    // 滚动到底部
    scrollToBottom(): void
}

export type TransmitMessageListDispatch = [{
    type: "add" | "remove" | "set" | "put" | "clear",
    timestamp?: number,
    messageInstance?: (TransmitTextMessage | TransmitFileMessage),
    initMessageList?: (TransmitTextMessage | TransmitFileMessage)[],
}];

const TransmitPage = forwardRef<TransmitPageRef, TransmitPageProps>(({ hidden, setHasNewTransmitMessage }: TransmitPageProps, ref) => {
    useImperativeHandle(ref, () => ({
        scrollToBottom() {
            listRef.current?.scrollToIndex(messageList.length - 1);
        },
    }));
    function onFileInputValueChange(event: React.ChangeEvent<HTMLInputElement>) {
        uploadTransmitFile(event.target.files![0]);
    }
    function uploadTransmitFile(file: File|{name:string,size:number,path:string}) {
        if (hasProgressingFile) {
            snackbar({
                message: "请等待上一个上传任务完成",
                autoCloseDelay: 1500
            });
            return
        }
        const fileTimestamp = Date.now();
        uploadingFileTimestamp.current = fileTimestamp;
        const messageInstance: TransmitFileMessage = {
            timestamp: fileTimestamp,
            type: "file",
            from: "computer",
            isDeleted: false,
            displayName: file.name,
            name: file.name,
            size: file.size
        }
        db.addData(messageInstance);
        fileInputRef.current!.value = "";
        messageListDispatch({
            type: "add",
            messageInstance
        });
        ipc.transmitUploadFile(file.name, file instanceof File?ipc.getFilePath(file):file.path, file.size);
        listRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" });
    }
    function onMessageListContextMenu() {
        ipc.createRightClickMenu(TransmitMessageListMenu).then(menu => {
            if (menu === RightClickMenuItemId.Upload) {
                fileInputRef.current?.click();
            }
        })
    }
    function onFileDragEnterComponent(event: React.DragEvent<HTMLDivElement>) {
        if (!event.dataTransfer.types.includes("Files") || event.dataTransfer.types.length !== 1) return
        setShowFileDragMark(true);
    }
    function onClearMessageList() {
        confirm({
            headline: "清空消息确认",
            description: "确认清空消息列表?\n接收的文件不会从硬盘中删除",
            confirmText: "确认",
            cancelText: "取消",
            onConfirm:async ()=>{
                await db.clearData()
                messageListDispatch({
                    type:"clear"
                })
            },
        })
    }
    const ipc = useMainWindowIpc();
    const [showFileDragMark, setShowFileDragMark] = useState(false);
    const [showFilterCard, setShowFilterCard] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchCapsSensitive, setSearchCapsSensitive] = useState(false);
    const db = useDatabase("transmit");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadingFileTimestamp = useRef<number>(null);
    const listRef = useRef<VirtuosoHandle>(null);
    const isAtBottom = useRef(true);
    let hasProgressingFile = false;
    const [messageList, messageListDispatch] = useReducer<(TransmitTextMessage | TransmitFileMessage)[], TransmitMessageListDispatch>((state, action) => {
        switch (action.type) {
            case "add":
                return [...state, action.messageInstance!];
            case "remove":
                return state.filter(item => item.timestamp !== action.timestamp);
            case "set":
                return [...action.initMessageList ?? []];
            case "clear":
                return [];
            case "put":
                return state.map(item => {
                    if (item.timestamp === action.timestamp) {
                        return action.messageInstance!;
                    }
                    return item;
                });
        }
    }, []);
    const filteredMessageList = useFuzzySearchList({
        list: messageList,
        queryText: searchText,
        strategy: "off",
        mapResultItem: ({ item }) => item,
        getText(item) {
            if (item.type === "file") return [item.displayName];
            if (item.type === "text") return [item.message];
            return [];
        },
    }).filter((value) => {
        if (showFilterCard && searchCapsSensitive) {
            if (value.type === "text") {
                return value.message.includes(searchText);
            } else if (value.type === "file") {
                return value.displayName.includes(searchText);
            }
        }
        return true
    }).sort((a, b) => a.timestamp - b.timestamp);
    const sortedMessageList = useMemo(() => filteredMessageList, [filteredMessageList, searchCapsSensitive]);
    useEffect(() => {
        db.getAllData().then(data => {
            messageListDispatch({
                type: "set",
                initMessageList: data
            });
            listRef.current?.scrollToIndex(data.length - 1);
        });
        // 接收到文本
        const appendTextCleanup = ipc.on("transmitAppendPlainText", text => {
            const messageInstance: TransmitTextMessage = {
                timestamp: Date.now(),
                type: "text",
                from: "phone",
                message: text,
            }
            if (!isAtBottom.current) {
                setHasNewTransmitMessage(true);
            }
            messageListDispatch({
                type: "add",
                messageInstance
            })
            db.addData(messageInstance);
        });
        // 接收就是有进度
        const appendFileCleanup = ipc.on("transmitAppendFile", file => {
            const messageTimestamp: number = Date.now();
            uploadingFileTimestamp.current = messageTimestamp;
            hasProgressingFile = true;
            const messageInstance: TransmitFileMessage = {
                timestamp: messageTimestamp,
                type: "file",
                from: "phone",
                isDeleted: false,
                displayName: file.displayName,
                name: file.fileName,
                size: file.size
            };
            db.addData(messageInstance);
            if (!isAtBottom.current) {
                setHasNewTransmitMessage(true);
            }
            messageListDispatch({
                type: "add",
                messageInstance: messageInstance
            });
        });
        const uploadFileSuccessListenerCleanup = ipc.on("transmitFileUploadSuccess", () => {
            hasProgressingFile = false;
            uploadingFileTimestamp.current = null;
        });
        const uploadFileFailListenerCleanup = ipc.on("transmitFileTransmitFailed", ({ title, message }) => {
            db.deleteData(uploadingFileTimestamp.current!);
            messageListDispatch({
                type: "remove",
                timestamp: uploadingFileTimestamp.current!
            });
            hasProgressingFile = false;
            alert({
                headline: title,
                description: message,
                confirmText: "确定",
                onConfirm: () => { },
            })
        });
        const dragOpenFileListenerCleanup = ipc.on("transmitDragFile", data => {
            uploadTransmitFile({
                name:data.filename,
                size:data.size,
                path:data.filePath
            })
        });
        return () => {
            appendTextCleanup();
            appendFileCleanup();
            uploadFileSuccessListenerCleanup();
            uploadFileFailListenerCleanup();
            dragOpenFileListenerCleanup();
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
    }, [hidden])
    return (
        <div onDragEnter={onFileDragEnterComponent} style={{ display: hidden ? "none" : "block" }} className="w-full" onContextMenu={onMessageListContextMenu}>
            {showFileDragMark && <DragFileMark onDropFile={uploadTransmitFile} setSelfShow={setShowFileDragMark} />}
            {showFilterCard && <ItemFilterCard setSearchText={setSearchText} setShowFilterCard={setShowFilterCard} extSwitchState={searchCapsSensitive} setExtSwitchState={setSearchCapsSensitive} extSwitchText="区分大小写" extSwitchIcon="keyboard_capslock"/>}
            {/* 列表内容 */}
            {sortedMessageList.length===0 &&<div className="absolute left-5/12 top-5/12 text-[gray]">暂无数据</div>}
            <Virtuoso
                className="w-full"
                ref={listRef}
                style={{ height: window.innerHeight * 0.85 }}
                data={sortedMessageList}
                followOutput={searchText === "" ? "smooth" : "auto"}
                atBottomThreshold={150}
                atBottomStateChange={(atBottom) => {
                    isAtBottom.current = atBottom;
                    if (atBottom) {
                        setHasNewTransmitMessage(false);
                    }
                }}
                itemContent={(_index, item) => {
                    switch (item.type) {
                        case "text":
                            return <TextMessage timestamp={item.timestamp} text={item.message} from={item.from} createRightClickMenu={ipc.createRightClickMenu} database={db} messageDispatch={messageListDispatch} openUrl={ipc.openUrl} />
                        case "file":
                            return <FileMessage data={item as TransmitFileMessage} progressing={uploadingFileTimestamp.current === item.timestamp} database={db} messageDispatch={messageListDispatch} />
                        default:
                            return <div className="text-red-500">Unknown message type:{(item as any)?.type ?? "null"}</div>
                    }
                }}
            />
            {/* 输入和菜单区 */}
            <div className="fixed w-full h-[8%] bottom-0 left-[9%] border-r-[5px] bg-[#f8edf9]">
                {/* 文件上传input */}
                <input type="file" hidden ref={fileInputRef} onChange={onFileInputValueChange} />
                <TransmitTextInputArea messageDispatch={messageListDispatch} database={db} list={listRef} />
                <mdui-dropdown>
                    {/* 菜单按钮 */}
                    <mdui-button slot="trigger" variant="text" className="ml-2.5">
                        <img src="./open_in_new.svg" />
                    </mdui-button>
                    <mdui-menu>
                        <mdui-menu-item onClick={onClearMessageList}>清空消息</mdui-menu-item>
                        <mdui-menu-item onClick={() => setShowFilterCard(state => !state)}>搜索</mdui-menu-item>
                        <mdui-menu-item onClick={() => fileInputRef.current?.click()}>上传文件</mdui-menu-item>
                        <mdui-menu-item onClick={() => ipc.openInExplorer("transmitFolder")}>打开文件夹</mdui-menu-item>
                    </mdui-menu>
                </mdui-dropdown>
            </div>
        </div>
    )
});

export default TransmitPage;

