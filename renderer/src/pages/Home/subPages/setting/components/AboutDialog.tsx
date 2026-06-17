import ApplicationVersion from "shared/const/ApplicationVersion";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import { OpenSourceList } from "../openSourceList";
import type { UpdateJson } from "~/types/chaos";
import { useState } from "react";
import { dialog, snackbar } from "mdui";
import ModalLayout from "~/components/ModalLayout";

interface AboutDialogProps {
    setVisible: React.Dispatch<React.SetStateAction<boolean>>
}
export default function AboutDialog({ setVisible }: AboutDialogProps) {
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const ipc = useMainWindowIpc();
    function openProjectUrl() {
        ipc.openUrl("https://github.com/NativeStar/SuishoConnector-Windows");
    }
    async function checkUpdate() {
        console.log("User manual check update");
        setCheckingUpdate(true);
        try {
            const updateJson: UpdateJson = await (await fetch("https://raw.githubusercontent.com/NativeStar/SuishoConnector-Windows/master/update.json")).json();
            if (ApplicationVersion.APPLICATION_VERSION_CODE < updateJson.versionCode) {
                console.log(`Find new version:${updateJson.versionCode}`);
                dialog({
                    actions: [
                        { text: "查看详情", onClick: () => ipc.openUrl("https://github.com/NativeStar/SuishoConnector-Windows/releases") },
                        { text: "取消" },
                        // 跳转浏览器下载
                        { text: "下载", onClick: () => ipc.openUrl(updateJson.downloadUrl) }
                    ],
                    headline: `发现新版本:${updateJson.versionName}`,
                    description: updateJson.description
                })
            } else {
                console.log(`Current is latest version:${updateJson.versionCode}`);
                snackbar({
                    message: "当前已是最新版本",
                    autoCloseDelay: 1500
                })
            }
        } catch (error) {
            snackbar({
                message: "检查更新失败 请确保网络环境可以访问Github",
                autoCloseDelay: 2500
            })
            console.error("Check update error");
            console.error(error);
        } finally {
            setCheckingUpdate(false)
        }
    }
    return (
        <ModalLayout onLayoutClick={() => setVisible(false)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[rgb(var(--mdui-color-surface-container-highest))] rounded-xl flex" onClick={(e) => e.stopPropagation()}>
                {/* 左侧 */}
                <div className="h-full flex flex-col flex-1 items-center mt-6">
                    <img src="./icon.png" className="size-30 mt-5" />
                    <span className="text-[gray] mt-1">Suisho Connector</span>
                    <span className="text-[gray] mt-0.5">{`${ApplicationVersion.APPLICATION_VERSION_NAME}(${ApplicationVersion.APPLICATION_VERSION_CODE})`}</span>
                    <span className="text-[gray] mt-0.5">协议版本:{`${ApplicationVersion.PROTOCOL_VERSION}`}</span>
                    <span className="text-[gray] mt-5">感谢使用</span>
                    <div className="text-[gray] mt-1">
                        项目已在
                        <span onClick={openProjectUrl} style={{ cursor: "pointer" }} className="underline pl-1 pr-1">Github</span>
                        开源
                    </div>
                    <mdui-button className="mt-1.5" loading={checkingUpdate} disabled={checkingUpdate} variant="text" onClick={checkUpdate}>检查更新</mdui-button>
                </div>
                {/* 右侧 */}
                <mdui-list className="h-full flex-1 overflow-y-scroll overflow-x-hidden">
                    <mdui-list-subheader className="ml-5">开放源代码许可</mdui-list-subheader>
                    {
                        OpenSourceList.map((item, index) => (
                            <mdui-list-item key={index} icon="link" onClick={() => ipc.openUrl(item.url)}>
                                <div className="flex-1">{item.name}</div>
                                <div className="text-[gray]">{item.url}</div>
                            </mdui-list-item>
                        ))
                    }
                </mdui-list>
            </div>
        </ModalLayout>
    )
}