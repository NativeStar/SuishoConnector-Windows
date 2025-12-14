import { alert, snackbar } from "mdui";
import { useEffect, useRef, useState } from "react";
import { RightClickMenuItemId } from "shared/const/RightClickMenuItems";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import useUpdateEffect from "~/hooks/useUpdateEffect";
import { FileManagerDownload } from "~/types/contextMenus";
import "react-modal-video/css/modal-video.css"
import { FileManagerResultCode, FileManagerResultCodeMessage } from "~/types/fileManagerResultCodes";
import type { FileItem } from "~/types/ipc";
import PhotoView from "./components/PhotoView";
import ModalVideo from 'react-modal-video';
import { getFileTypeIcon, getSupportType, ModalVideoClassNames } from "./constance";

interface FileManagerPageProps {
    hidden: boolean
}
interface FileListProps {
    currentPath: string[] | null
    hasPermission: boolean
    setHasPermission: React.Dispatch<React.SetStateAction<boolean>>
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    setCurrentPath: React.Dispatch<React.SetStateAction<string[] | null>>
    fileUrl: React.RefObject<string>
    setImageViewVisible: React.Dispatch<React.SetStateAction<boolean>>
    setVideoViewVisible: React.Dispatch<React.SetStateAction<boolean>>
}
interface DirectoryListProps {
    setCurrentPath: React.Dispatch<React.SetStateAction<string[] | null>>
}
function DirectoryList({ setCurrentPath }: DirectoryListProps) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <mdui-list className="w-[28%]">
            <mdui-list-item icon="phone_android" onClick={() => setCurrentPath([])}>内部存储</mdui-list-item>
            <mdui-list-item icon="download" onClick={() => setCurrentPath(["Download"])}>Download目录</mdui-list-item>
            <mdui-collapse>
                <mdui-collapse-item className="fileManagerDirectoryList overflow-y-auto max-h-[calc(100vh-10rem)]">
                    <mdui-list-item onClick={() => setCollapsed(!collapsed)} slot="header" icon="star">
                        收藏目录
                        <mdui-icon slot="end-icon" name={collapsed ? "keyboard_arrow_up" : "keyboard_arrow_down"}></mdui-icon>
                    </mdui-list-item>
                </mdui-collapse-item>
            </mdui-collapse>
        </mdui-list>
    )
}
function FileList({ currentPath, hasPermission, setHasPermission, setLoading, setCurrentPath, fileUrl, setImageViewVisible, setVideoViewVisible }: FileListProps) {
    let baseRemoteFileUrl = "";
    const [fileList, setFileList] = useState<FileItem[]>([])
    const ipc = useMainWindowIpc();
    const listRef = useRef<HTMLElement>(null);
    useUpdateEffect(() => {
        if (currentPath === null) {
            return
        }
        if (!hasPermission) {
            alert({
                headline: "获取权限失败",
                description: "请给予安卓端'管理所有文件'权限",
                confirmText: "刷新",
                onConfirm: () => {
                    ipc.checkAndroidClientPermission("android.permission.MANAGE_EXTERNAL_STORAGE").then(({ result }) => {
                        setHasPermission(result);
                    })
                }
            }).catch(() => { });
            return
        }
        setLoading(true);
        ipc.getPhoneDirectoryFiles(`/storage/emulated/0/${currentPath.join("/")}/`).then(result => {
            if (result.code !== FileManagerResultCode.CODE_NORMAL) {
                snackbar({
                    message: FileManagerResultCodeMessage[result.code as keyof typeof FileManagerResultCodeMessage],
                    autoCloseDelay: 1750
                });
                setLoading(false);
                // 将添加的path弹出 否则目录会乱
                setCurrentPath(currentPath!.slice(0, -1));
                return
            }
            setFileList(result.files);
            setLoading(false);
        })
    }, [currentPath]);
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            //鼠标侧键返回
            if (event.button === 3) {
                event.preventDefault();
                event.stopPropagation();
                if (currentPath?.length !== 0) setCurrentPath(currentPath!.slice(0, -1))
            }
        }
        listRef.current?.addEventListener("mousedown", onMouseDown);
        return () => {
            listRef.current?.removeEventListener("mousedown", onMouseDown);
        }
    }, [currentPath]);
    ipc.getPhoneIp().then(addr => baseRemoteFileUrl = `https://${addr}:30767?filePath=`)
    function onContextMenu(name: string) {
        ipc.createRightClickMenu(FileManagerDownload).then(result => {
            if (result === RightClickMenuItemId.Download) {
                ipc.downloadPhoneFile(`/storage/emulated/0/${currentPath!.join("/")}/${name}`)
            }
        })
    }
    return (
        <>
            {currentPath === null ?
                <div className="w-[72%] absolute left-[50%] top-[42%] text-[gray]">
                    {hasPermission ? "选择一个目录开始浏览文件" : "设备未开启相关权限"}
                </div>
                :
                <mdui-list ref={listRef} className="w-[72%] h-[calc(100vh-2.5rem)] overflow-y-scroll absolute left-[28%] top-0 overflow-x-hidden">
                    {currentPath.length !== 0 && <mdui-list-item icon="keyboard_backspace" onClick={() => {
                        setCurrentPath(currentPath!.slice(0, -1))
                    }}>..</mdui-list-item>}
                    {fileList.length === 0 && <div className="w-full text-[gray] text-center mt-[40%]">该目录为空</div>}
                    {
                        fileList.sort((a, b) => {
                            if (a.type === "folder" && b.type === "file") return -1;
                            if (a.type === "file" && b.type === "folder") return 1;
                            return 0;
                        }).map(file => (
                            <mdui-list-item onContextMenu={() => {
                                file.type === "file" && onContextMenu(file.name)
                            }} icon={file.type === "folder" ? "folder" : getFileTypeIcon(file.name)} key={file.name} onClick={() => {
                                if (file.type === "file") {
                                    switch (getSupportType(file.name)) {
                                        case "audio":
                                            // TODO
                                            console.log("TODO");
                                            return
                                        case "image":
                                            fileUrl.current = baseRemoteFileUrl + encodeURIComponent(`/storage/emulated/0/${currentPath!.join("/")}/${file.name}`);
                                            setImageViewVisible(true)
                                            return
                                        case "video":
                                            fileUrl.current = baseRemoteFileUrl + encodeURIComponent(`/storage/emulated/0/${currentPath!.join("/")}/${file.name}`);
                                            setVideoViewVisible(true)
                                            return
                                        case "none":
                                            break
                                    }
                                    // 在这触发下载太容易误触
                                    snackbar({
                                        message: "如需下载请右键点击",
                                        autoCloseDelay: 750
                                    });
                                    return
                                }
                                setCurrentPath([...currentPath!, file.name])
                            }}>
                                {file.name}
                            </mdui-list-item>
                        ))
                    }
                </mdui-list>}
        </>
    )
}
export default function FileManagerPage({ hidden }: FileManagerPageProps) {
    const [hasPermission, setHasPermission] = useState(false);
    const ipc = useMainWindowIpc();
    const [currentPath, setCurrentPath] = useState<string[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [videoViewerVisible, setVideoViewerVisible] = useState(false)
    const fileUrl = useRef<string>("");
    useEffect(() => {
        ipc.checkAndroidClientPermission("android.permission.MANAGE_EXTERNAL_STORAGE").then(({ result }) => {
            setHasPermission(result);
        })
    }, []);
    return (
        <div style={{ display: hidden ? "none" : "block" }}>
            <ModalVideo classNames={ModalVideoClassNames} channel="custom" url={fileUrl.current} isOpen={videoViewerVisible} onClose={() => setVideoViewerVisible(false)} />
            <PhotoView setVisible={setImageViewerVisible} visible={imageViewerVisible} imageUrl={fileUrl.current} />
            <DirectoryList setCurrentPath={setCurrentPath} />
            {loading && <div className="absolute top-0 w-full h-full opacity-75 bg-[gray] text-center pt-[37%] z-10">
                <mdui-linear-progress className="w-[25%]"></mdui-linear-progress>
            </div>}
            <FileList currentPath={currentPath} hasPermission={hasPermission} setHasPermission={setHasPermission} setLoading={setLoading} setCurrentPath={setCurrentPath} fileUrl={fileUrl} setImageViewVisible={setImageViewerVisible} setVideoViewVisible={setVideoViewerVisible} />
        </div>
    )
}
