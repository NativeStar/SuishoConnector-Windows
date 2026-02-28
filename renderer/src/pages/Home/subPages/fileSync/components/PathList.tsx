import { snackbar } from "mdui";
import { useEffect } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";

interface PathListItemProps {
    path: string
    onRemove: (path:string) => void
}
interface PathListProps {
    paths: string[]
    setPaths:React.Dispatch<React.SetStateAction<string[]>>
}
function PathListItem({ path ,onRemove}: PathListItemProps) {
    return (
        <mdui-tooltip>
            <span className="whitespace-normal wrap-anywhere break-all" slot="content">具体路径:{path}
                <br />
                右键单击移除该目录
            </span>
            <mdui-list-item style={{ direction: "rtl" }} className="whitespace-normal wrap-anywhere break-all" headline={path} headline-line={1} onContextMenu={()=>onRemove(path)}></mdui-list-item>
        </mdui-tooltip>
    )
}
export default function PathList({paths,setPaths}:PathListProps) {
    const ipc=useMainWindowIpc();
    useEffect(() => {
        ipc.getDeviceConfig<string[]>("fileSyncTargetDirectory",[]).then(value=>{
            setPaths(value)
        })
    },[]);
    function removeItem(path:string){
        ipc.removeWatchPath(path).then(()=>{
            setPaths(paths.filter(item=>item!==path))
            snackbar({
                message: "移除成功",
                autoCloseDelay: 1500
            })
        })
    }
    return (
        <mdui-list className="w-4/12">
            <mdui-list-subheader>路径列表</mdui-list-subheader>
            <div className="smallScrollBar overflow-y-auto max-h-[calc(100vh-9.4rem)]">
                {paths.length === 0 && <span className="text-[gray] absolute left-12.5">暂无同步路径</span>}
                {paths.map(path => <PathListItem path={path} key={path} onRemove={removeItem}/>)}
            </div>
        </mdui-list>
    )
}