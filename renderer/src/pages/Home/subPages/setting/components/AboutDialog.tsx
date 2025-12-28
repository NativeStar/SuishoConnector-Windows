import ApplicationVersion from "shared/const/ApplicationVersion";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import { OpenSourceList } from "../openSourceList";

interface AboutDialogProps {
    setVisible: React.Dispatch<React.SetStateAction<boolean>>
}
export default function AboutDialog({ setVisible }: AboutDialogProps) {
    const ipc=useMainWindowIpc();
    function openProjectUrl() {
        ipc.openUrl("https://github.com/NativeStar/SuishoConnector-Windows");
    }
    return (
        <div className="w-full h-full fixed bg-black/50 left-0 z-10" onClick={() => setVisible(false)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[#fdf7fe] rounded-xl flex" onClick={(e) => e.stopPropagation()}>
                {/* 左侧 */}
                <div className="h-full flex flex-col flex-1 items-center mt-6">
                    <img src="./icon.png" className="size-30 mt-5" />
                    <span className="text-[gray] mt-1">Suisho Connector</span>
                    <span className="text-[gray] mt-0.5">{`${ApplicationVersion.APPLICATION_VERSION_NAME}(${ApplicationVersion.APPLICATION_VERSION_CODE})`}</span>
                    <span className="text-[gray] mt-5">感谢支持</span>
                    <div className="text-[gray] mt-1">
                        项目已在
                        <span onClick={openProjectUrl} style={{cursor:"pointer"}} className="underline pl-1 pr-1">Github</span>
                        开源
                    </div>
                    <small className="easterEggText mt-9 text-xs">没有星星的夜里</small>
                </div>
                {/* 右侧 */}
                <mdui-list className="h-full flex-1 overflow-y-scroll overflow-x-hidden">
                <mdui-list-subheader className="ml-5">开放源代码许可</mdui-list-subheader>
                    {
                        OpenSourceList.map((item, index) => (
                            <mdui-list-item key={index} icon="link" onClick={()=>ipc.openUrl(item.url)}>
                                <div className="flex-1">{item.name}</div>
                                <div className="text-[gray]">{item.url}</div>
                            </mdui-list-item>
                        ))
                    }
                </mdui-list>
            </div>
        </div>
    )
}