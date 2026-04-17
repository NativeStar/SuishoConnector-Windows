import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { alert, confirm, snackbar } from "mdui";
import TransmitTextInputArea from "./components/TransmitTextInputArea";
import { forwardRef, useImperativeHandle, useEffect, useMemo, useReducer, useRef, useState, useContext, useCallback } from "react";
import useDatabase from "~/hooks/useDatabase";
import type { TransmitFileMessage, TransmitTextMessage } from "~/types/database";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import { FileMessage, TextMessage } from "./components/TransmitMessage";
import { TransmitMessageListMenu } from "~/types/contextMenus";
import { RightClickMenuItemId } from "shared/const/RightClickMenuItems";
import DragFileMark from "./components/DragFileMark";
import { useFuzzySearchList } from "@nozbe/microfuzz/react"
import ItemFilterCard from "../../components/ItemFilterCard";
import UploadImagePreviewDialog from "./components/UploadImagePreviewDialog";
import AndroidIdContext from "~/context/AndroidIdContext";
import { FolderListDialog } from "./components/FolderListDialog";
import { PhotoSlider } from "react-photo-view";

interface TransmitPageProps {
    hidden: boolean,
    setHasNewTransmitMessage: React.Dispatch<React.SetStateAction<boolean>>
}
type UploadFileDescriptor = {
    name: string,
    size: number,
    path: string,
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
    const { androidId } = useContext(AndroidIdContext)
    useImperativeHandle(ref, () => ({
        scrollToBottom() {
            listRef.current?.scrollToIndex(messageList.length - 1);
        },
    }));
    const hasProgressingFileRef = useRef(false);
    function onFileInputValueChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (!event.target.files || event.target.files.length === 0) return;
        uploadMultipleFile(Array.from(event.target.files));
    }
    function uploadTransmitFile(file: File | UploadFileDescriptor, timestamp?: number, appendMessage = true) {
        const filePath = file instanceof File ? ipc.getFilePath(file) : file.path;
        //实际上如果从资源管理器拖文件 会因为'/'变成'\'误打误撞躲开误判
        if (filePath.includes(`phonelinker/programData/devices_data/${androidId}/transmit_files/`)) {
            snackbar({
                message: "无法上传来自自身的文件",
                autoCloseDelay: 1200
            })
            return
        }
        const fileTimestamp = timestamp ?? Date.now();
        fileInputRef.current!.value = "";
        if (hasProgressingFileRef.current) {
            setMultipleUploadFilesList(prev => [...prev, { time: fileTimestamp, file }]);
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
            messageListDispatch({
                type: "add",
                messageInstance
            });
            console.debug(`Add file'${file.name}' to multiple upload list`);
            return
        }
        hasProgressingFileRef.current = true;
        setUploadingFileTimestamp(fileTimestamp);
        if (appendMessage) {
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
            messageListDispatch({
                type: "add",
                messageInstance
            });
        }
        ipc.transmitUploadFile(file.name, filePath, file.size);
        setTimeout(() => {
            listRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" });
        }, 150);
        console.info("Transmit start upload a file");
    }
    function onMessageListContextMenu() {
        ipc.createRightClickMenu(TransmitMessageListMenu).then(menu => {
            if (menu === RightClickMenuItemId.Upload) {
                console.debug("Show file upload dialog");
                fileInputRef.current?.click();
            } else if (menu === RightClickMenuItemId.OpenTransmitFolder) {
                console.log("Open transmit folder in right click menu");
                ipc.openInExplorer("transmitFolder")
            }
        })
    }
    function onFileDragEnterComponent(event: React.DragEvent<HTMLDivElement>) {
        if (!event.dataTransfer.types.includes("Files") || event.dataTransfer.types.length !== 1) return
        console.debug("Show file frag mark");
        setShowFileDragMark(true);
    }
    function onClearMessageList() {
        confirm({
            headline: "清空消息确认",
            description: "确认清空消息列表?\n接收的文件不会从硬盘中删除",
            confirmText: "确认",
            cancelText: "取消",
            onConfirm: async () => {
                await db.clearData()
                messageListDispatch({
                    type: "clear"
                });
                console.info("Clean all transmit history");
            },
        })
    }
    function onPagePaste() {
        console.debug("User paste data in transmit input area");
        navigator.clipboard.read().then(async (clipboardItems) => {
            if (clipboardItems.length === 0 || !clipboardItems[0].types.some(value => value.startsWith("image/"))) {
                console.debug("Paste non image data,Skip");
                return
            }
            const targetItem = clipboardItems[0];
            const imageBlob = await targetItem.getType(targetItem.types[0]);
            console.debug(`Pasted data type:${targetItem.types[0]}`);
            // 等待用户确认上传
            setPreviewImage(imageBlob)
        })
    }
    async function uploadClipboardImage() {
        console.debug("User upload image from clipboard");
        const imageArrayBuffer = await previewImage?.arrayBuffer();
        if (!imageArrayBuffer) {
            console.warn("Failed to get image array buffer on clipboard!");
            alert({
                headline: "上传失败",
                description: "获取数据时发生异常",
                confirmText: "确认",
            });
            return
        }
        setPreviewImage(null);
        const fileName = `ClipboardImage-${Date.now()}.png`;
        const tempImageFilePath = await ipc.createCacheFile(fileName, imageArrayBuffer);
        console.debug("Upload clipboard image file");
        uploadTransmitFile({ name: fileName, size: imageArrayBuffer.byteLength, path: tempImageFilePath });
    }

    const ipc = useMainWindowIpc();
    const [showFileDragMark, setShowFileDragMark] = useState(false);
    const [showFilterCard, setShowFilterCard] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [previewImage, setPreviewImage] = useState<Blob | null>(null);
    const [userDropFolder, setUserDropFolder] = useState<FileSystemEntry[] | null>(null);
    const [searchCapsSensitive, setSearchCapsSensitive] = useState(false);
    const db = useDatabase("transmit");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFileTimestamp, setUploadingFileTimestamp] = useState(0);
    const listRef = useRef<VirtuosoHandle>(null);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [multipleUploadFilesList, setMultipleUploadFilesList] = useState<{ time: number, file: File | UploadFileDescriptor }[]>([]);
    const isAtBottom = useRef(true);
    const previewFileUrl = useRef<string>("");
    const setImagePreview = useCallback((url:string|null) => {
        if(url){
            previewFileUrl.current = url;
            setImageViewerVisible(true);
        }else{
            setImageViewerVisible(false);
        }
    }, []);
    function uploadMultipleFile(fileList: (File | UploadFileDescriptor)[]) {
        if (fileList.length === 0) return
        let parsedFileInstanceList: { time: number, file: File | UploadFileDescriptor }[];
        let timestampOffset = 2;
        if (hasProgressingFileRef.current) {
            parsedFileInstanceList = fileList.map(file => {
                const parsedFileInstance = {
                    time: Date.now() + timestampOffset,
                    file
                }
                timestampOffset += 1;
                return parsedFileInstance;
            })
        } else {
            // 防止时间戳重复
            const firstFileTimestamp = Date.now();
            const [firstFile, ...removedFileList] = fileList;
            parsedFileInstanceList = removedFileList.map(file => {
                const parsedFileInstance = {
                    time: Date.now() + timestampOffset,
                    file
                }
                timestampOffset += 1;
                return parsedFileInstance;
            })
            uploadTransmitFile(firstFile, firstFileTimestamp);
        }
        setMultipleUploadFilesList(prev => [...prev, ...parsedFileInstanceList]);
        //提前追加消息列表
        for (const fileInfo of parsedFileInstanceList) {
            const messageInstance: TransmitFileMessage = {
                timestamp: fileInfo.time,
                type: "file",
                from: "computer",
                isDeleted: false,
                displayName: fileInfo.file.name,
                name: fileInfo.file.name,
                size: fileInfo.file.size
            }
            db.addData(messageInstance);
            messageListDispatch({
                type: "add",
                messageInstance
            });
        }
    }
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
            console.info("Init transmit message success");
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
            console.debug(`Receive new transmit text:${messageInstance.message}`);
        });
        // 接收就是有进度
        const appendFileCleanup = ipc.on("transmitAppendFile", file => {
            const messageTimestamp: number = Date.now();
            setUploadingFileTimestamp(messageTimestamp)
            hasProgressingFileRef.current = true;
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
            console.debug(`Transmit receive new file:${messageInstance.name}`);
        });
        const dragOpenFileListenerCleanup = ipc.on("transmitDragFile", data => {
            uploadTransmitFile({
                name: data.filename,
                size: data.size,
                path: data.filePath
            });

            console.debug(`Transmit drag a new file`);
        });
        return () => {
            appendTextCleanup();
            appendFileCleanup();
            dragOpenFileListenerCleanup();
        }
    }, []);
    //处理多选文件上传
    useEffect(() => {
        const uploadFileSuccessListenerCleanup = ipc.on("transmitFileUploadSuccess", () => {
            hasProgressingFileRef.current = false;
            setUploadingFileTimestamp(0)
            //检查多选队列
            if (multipleUploadFilesList.length > 0) {
                const [firstFile, ...removedFileList] = multipleUploadFilesList;
                setMultipleUploadFilesList(removedFileList);
                //延迟一段时间 避免主进程还有些东西没处理
                uploadTransmitFile(firstFile.file, firstFile.time, false);
            }
            console.debug(`Transmit receive file success`);
        });
        const uploadFileFailListenerCleanup = ipc.on("transmitFileTransmitFailed", ({ title, message }) => {
            db.deleteData(uploadingFileTimestamp);
            messageListDispatch({
                type: "remove",
                timestamp: uploadingFileTimestamp
            });
            hasProgressingFileRef.current = false;
            alert({
                headline: title,
                description: message,
                confirmText: "确定",
                onConfirm: () => { },
            })
            //任何一个传输失败都清空多选队列
            //移除已追加的消息
            for (const fileInfo of multipleUploadFilesList) {
                messageListDispatch({
                    type: "remove",
                    timestamp: fileInfo.time
                });
                db.deleteData(fileInfo.time);
            }
            setMultipleUploadFilesList([]);
            console.warn(`Transmit receive file failed:${message}`);
        });
        return () => {
            uploadFileSuccessListenerCleanup();
            uploadFileFailListenerCleanup();
        }
    }, [multipleUploadFilesList])
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
                    console.debug("Show transmit forward page filter card");
                }
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [hidden])
    return (
        <>
            {userDropFolder && <FolderListDialog itemList={userDropFolder} setItemList={setUserDropFolder} uploadMultipleFiles={uploadMultipleFile} />}
            {previewImage && <UploadImagePreviewDialog imageBlob={previewImage} setImageBlob={setPreviewImage} uploadFunction={uploadClipboardImage} />}
            <PhotoSlider
                maskOpacity={0.8}
                images={[{ key: previewFileUrl.current || "preview", src: previewFileUrl.current }]}
                visible={imageViewerVisible}
                onClose={() => setImagePreview(null)}
                bannerVisible
                loop={false}
                portalContainer={document.body}
            />
            <div onDragEnter={onFileDragEnterComponent} style={{ display: hidden ? "none" : "block" }} className="w-full" onContextMenu={onMessageListContextMenu}>
                {showFileDragMark && <DragFileMark onDropFile={uploadTransmitFile} setSelfShow={setShowFileDragMark} setUserDropFolder={setUserDropFolder} uploadMultipleFiles={uploadMultipleFile} />}
                {showFilterCard && <ItemFilterCard setSearchText={setSearchText} setShowFilterCard={setShowFilterCard} extSwitchState={searchCapsSensitive} setExtSwitchState={setSearchCapsSensitive} extSwitchText="区分大小写" extSwitchIcon="keyboard_capslock" />}
                {/* 列表内容 */}
                {sortedMessageList.length === 0 && <div className="absolute left-5/12 top-5/12 text-[gray]">暂无数据</div>}
                <Virtuoso
                    className="w-full"
                    ref={listRef}
                    increaseViewportBy={{ top: 725, bottom: 725 }}
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
                                return <FileMessage data={item as TransmitFileMessage} progressing={uploadingFileTimestamp === item.timestamp} database={db} messageDispatch={messageListDispatch} setImagePreview={setImagePreview}/>
                            default:
                                return <div className="text-red-500">Unknown message type:{(item as any)?.type ?? "null"}</div>
                        }
                    }}
                />
                {/* 输入和菜单区 */}
                <div className="fixed w-full h-[8%] bottom-0 left-[9%] border-r-[5px] bg-[rgb(var(--mdui-color-surface-container-low))]" onPaste={onPagePaste}>
                    {/* 文件上传input */}
                    <input type="file" multiple hidden ref={fileInputRef} onChange={onFileInputValueChange} />
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
        </>
    )
});

export default TransmitPage;

