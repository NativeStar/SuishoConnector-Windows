import { alert, snackbar } from "mdui";
import { useEffect, useRef, useState } from "react";
import { RightClickMenuItemId } from "shared/const/RightClickMenuItems";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import useUpdateEffect from "~/hooks/useUpdateEffect";
import { FileManagerDownload, FileManagerStarDirectory, FileManagerUnStarDirectory } from "~/types/contextMenus";
import "react-modal-video/css/modal-video.css"
import { FileManagerResultCode, FileManagerResultCodeMessage, isDotPopPathResultCode } from "~/types/fileManagerResultCodes";
import type { FileItem } from "~/types/ipc";
import ModalVideo from 'react-modal-video';
import { getFileTypeIcon, getSupportType, ModalVideoClassNames } from "./constance";
import { PhotoSlider } from "react-photo-view";
import AudioModal from "./components/AudioModal";
import { releaseFfmpeg } from "~/utils";

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
    setAudioPlayerVisible: React.Dispatch<React.SetStateAction<boolean>>
    staredDirectories: string[]
    setStaredDirectories: React.Dispatch<React.SetStateAction<string[]>>
}
interface DirectoryListProps {
    setCurrentPath: React.Dispatch<React.SetStateAction<string[] | null>>
    staredDirectories: string[]
    setStaredDirectories: React.Dispatch<React.SetStateAction<string[]>>
    createRightClickMenu: typeof window.electronMainProcess.createRightClickMenu
}
function DirectoryList({ setCurrentPath, setStaredDirectories, staredDirectories, createRightClickMenu }: DirectoryListProps) {
    const [collapsed, setCollapsed] = useState(false);
    useEffect(() => {
        const rawStaredDir = localStorage.getItem("fileManagerStaredDirectory");
        if (rawStaredDir !== null) {
            const staredDir: string[] = JSON.parse(rawStaredDir);
            setStaredDirectories(staredDir);
            console.debug(`Stared directories raw data:${rawStaredDir}`);
        }
    }, []);
    function onContextMenu(path: string) {
        createRightClickMenu(FileManagerUnStarDirectory).then(result => {
            if (result === RightClickMenuItemId.Delete) {
                localStorage.setItem("fileManagerStaredDirectory", JSON.stringify(staredDirectories.filter(value => value !== path)));
                setStaredDirectories(staredDirectories.filter(value => value !== path));
                console.debug(`Remove stared directory:${path}`);
            }
        })
    }
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
                    {
                        staredDirectories.map(value => (
                            <mdui-list-item icon="star_outline" key={value} onClick={() => setCurrentPath(value.split("/"))} onContextMenu={() => onContextMenu(value)}>{value.slice(value.lastIndexOf("/") + 1)}</mdui-list-item>
                        ))
                    }
                </mdui-collapse-item>
            </mdui-collapse>
        </mdui-list>
    )
}
function FileList({
    currentPath,
    hasPermission,
    setHasPermission,
    setLoading,
    setCurrentPath,
    fileUrl,
    setImageViewVisible,
    setVideoViewVisible,
    setAudioPlayerVisible,
    staredDirectories,
    setStaredDirectories
}: FileListProps) {
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
                    ipc.sendRequestPacket<{ result: boolean }>({ packetType: "main_checkPermission", name: "android.permission.MANAGE_EXTERNAL_STORAGE" }).then(({ result }) => {
                        setHasPermission(result);
                    })
                }
            }).catch(() => { });
            console.debug(`List phone file failed:not permission`);
            return
        }
        setLoading(true);
        // 更改目录趁机释放ffmpeg
        releaseFfmpeg();
        ipc.sendRequestPacket<{ code: number, files: FileItem[] }>({ packetType: "file_getFilesList", msg: `/storage/emulated/0/${currentPath.join("/")}/` }).then(result => {
            if (result.code !== FileManagerResultCode.CODE_NORMAL) {
                snackbar({
                    message: FileManagerResultCodeMessage[result.code as keyof typeof FileManagerResultCodeMessage],
                    autoCloseDelay: 1750
                });
                setLoading(false);
                // 将添加的path弹出 否则目录会乱
                if(!isDotPopPathResultCode(result.code)) setCurrentPath(currentPath!.slice(0, -1));
                console.info(`Get phone directory files failed with code:${result.code}`);
                return
            }
            console.debug(`Got phone file list:${JSON.stringify(result.files ?? [])}`);
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
    function onContextMenu(file: FileItem) {
        ipc.createRightClickMenu(file.type === "folder" ? FileManagerStarDirectory : FileManagerDownload).then(result => {
            if (result === RightClickMenuItemId.Download) {
                ipc.downloadPhoneFile(`/storage/emulated/0/${currentPath!.join("/")}/${file.name}`);
                console.info(`Request download phone file:${file.name}`);
            } else if (result === RightClickMenuItemId.Star) {
                const joinedPath = currentPath!.join("/");
                const finalPath = `${joinedPath !== "" ? `${joinedPath}/` : ""}${file.name}`;
                // 避免重复
                if (staredDirectories.includes(finalPath)) return;
                setStaredDirectories([...staredDirectories, finalPath]);
                console.info(`Add stared phone directory:${finalPath}`);
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
                            const aHasCn = /[\u4e00-\u9fff]/.test(a.name);
                            const bHasCn = /[\u4e00-\u9fff]/.test(b.name);
                            if (aHasCn && !bHasCn) return 1;
                            if (!aHasCn && bHasCn) return -1;
                            return a.name.localeCompare(b.name, 'zh-CN', {
                                usage: "sort",
                                collation: "pinyin",
                                caseFirst: "upper",
                                numeric: true,
                                sensitivity: 'base'
                            });
                        }).map(file => (
                            <mdui-list-item onContextMenu={() => onContextMenu(file)} icon={file.type === "folder" ? "folder" : getFileTypeIcon(file.name)} key={file.name} onClick={async () => {
                                if (file.type === "file") {
                                    switch (getSupportType(file.name)) {
                                        case "audio":
                                            fileUrl.current = baseRemoteFileUrl + encodeURIComponent(`/storage/emulated/0/${currentPath!.join("/")}/${file.name}`);
                                            setAudioPlayerVisible(true);
                                            console.debug(`Preview audio file:${fileUrl.current}`);
                                            return
                                        case "image":
                                            fileUrl.current = baseRemoteFileUrl + encodeURIComponent(`/storage/emulated/0/${currentPath!.join("/")}/${file.name}`);
                                            setImageViewVisible(true);
                                            console.debug(`Preview image file:${fileUrl.current}`);
                                            return
                                        case "video":
                                            fileUrl.current = baseRemoteFileUrl + encodeURIComponent(`/storage/emulated/0/${currentPath!.join("/")}/${file.name}`);
                                            setVideoViewVisible(true)
                                            console.debug(`Preview video file:${fileUrl.current}`);
                                            return
                                        case "none":
                                            break
                                    }
                                    // 在这触发下载太容易误触
                                    snackbar({
                                        message: "不支持预览该文件 如需下载请右键点击",
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
    const [staredDirectories, setStaredDirectories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [videoViewerVisible, setVideoViewerVisible] = useState(false);
    const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
    const fileUrl = useRef<string>("");
    useEffect(() => {
        ipc.sendRequestPacket<{ result: boolean }>({ packetType: "main_checkPermission", name: "android.permission.MANAGE_EXTERNAL_STORAGE" }).then(({ result }) => {
            setHasPermission(result);
        })
    }, []);
    useUpdateEffect(() => {
        // 保存数据
        const dataString = JSON.stringify(staredDirectories);
        localStorage.setItem("fileManagerStaredDirectory", dataString);
    }, [staredDirectories]);
    return (
        <div style={{ display: hidden ? "none" : "block" }}>
            {audioPlayerVisible && <AudioModal setVisible={setAudioPlayerVisible} src={fileUrl.current} />}
            <ModalVideo classNames={ModalVideoClassNames} channel="custom" url={fileUrl.current} isOpen={videoViewerVisible} onClose={() => setVideoViewerVisible(false)} />
            <PhotoSlider
                maskOpacity={0.8}
                images={[{ key: fileUrl.current || "preview", src: fileUrl.current }]}
                visible={imageViewerVisible}
                onClose={() => setImageViewerVisible(false)}
                bannerVisible
                loop={false}
                portalContainer={document.body}
            />
            <DirectoryList setCurrentPath={setCurrentPath} setStaredDirectories={setStaredDirectories} staredDirectories={staredDirectories} createRightClickMenu={ipc.createRightClickMenu} />
            {loading && <div className="absolute top-0 w-full h-full opacity-75 bg-[gray] text-center pt-[37%] z-10">
                <mdui-linear-progress className="w-[25%]"></mdui-linear-progress>
            </div>}
            <FileList
                currentPath={currentPath}
                hasPermission={hasPermission}
                setHasPermission={setHasPermission}
                setLoading={setLoading}
                setCurrentPath={setCurrentPath}
                fileUrl={fileUrl}
                setImageViewVisible={setImageViewerVisible}
                setVideoViewVisible={setVideoViewerVisible}
                setAudioPlayerVisible={setAudioPlayerVisible}
                setStaredDirectories={setStaredDirectories}
                staredDirectories={staredDirectories} />
        </div>
    )
}
