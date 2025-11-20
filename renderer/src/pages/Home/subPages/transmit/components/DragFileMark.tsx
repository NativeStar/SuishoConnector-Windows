import { snackbar } from "mdui";

interface DragFileMarkProps {
    onDropFile: (file: File) => void,
    setSelfShow: React.Dispatch<React.SetStateAction<boolean>>
}
export default function DragFileMark({ setSelfShow ,onDropFile}: DragFileMarkProps) {
    function onDragLeave(event: React.DragEvent<HTMLDivElement>) {
        //检测是否真的拖出了遮罩外
        const relatedTarget: HTMLElement | null = event.relatedTarget as HTMLElement;
        if (relatedTarget && (relatedTarget.innerText === "在此释放以上传" || relatedTarget.innerText === "upload")) {
            return
        }
        setSelfShow(false)
    }
    function onDrop(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setSelfShow(false);
        if (event.dataTransfer.files.length === 0) {
            snackbar({
                message: "请拖入一个文件",
                autoCloseDelay: 1200
            });
            return
        }
        if (event.dataTransfer.files.length >= 2) {
            snackbar({
                message: "暂时只支持单个文件上传",
                autoCloseDelay: 1200
            });
            return
        }
        if (event.dataTransfer.items[0].webkitGetAsEntry()?.isDirectory) {
            snackbar({
                message: "不支持上传文件夹",
                autoCloseDelay: 1200
            });
            return
        }
        onDropFile(event.dataTransfer.files[0])
    }
    return (
        <div onDrop={onDrop} onDragLeave={onDragLeave} onDragOver={e => e.preventDefault()} className="flex flex-col items-center absolute w-full h-full opacity-75 bg-[gray] z-10 pt-[35%]">
            <mdui-icon className="text-5xl -z-10" name="upload" />
            在此释放以上传
        </div>
    )
}