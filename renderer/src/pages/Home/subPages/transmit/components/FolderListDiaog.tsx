import { useMemo, useState } from "react"

interface FolderListDialogProps {
    itemList: FileSystemEntry[]
    setItemList: React.Dispatch<React.SetStateAction<FileSystemEntry[] | null>>
}
interface FileItemProps {
    file: FileSystemEntry
    checkedFiles: FileSystemEntry[]
    setCheckedFiles: React.Dispatch<React.SetStateAction<FileSystemEntry[]>>
}
function FileItem({ file, checkedFiles, setCheckedFiles }: FileItemProps) {
    return (
        <mdui-list-item headline={file.name} key={file.name} onClick={() => {
            if (file.isDirectory) return
            if (checkedFiles.includes(file)) {
                setCheckedFiles(checkedFiles.filter(item => item.name !== file.name))
            } else {
                setCheckedFiles([...checkedFiles, file])
            }
        }}>
            <mdui-icon slot="icon" name={file.isDirectory ? "folder" : "insert_drive_file"}></mdui-icon>
            <mdui-checkbox className="pointer-events-none" slot="end-icon" checked={checkedFiles.includes(file)} disabled={file.isDirectory}></mdui-checkbox>
        </mdui-list-item>
    )
}
export function FolderListDialog({ itemList, setItemList }: FolderListDialogProps) {
    const sortedList = useMemo(() => {
        return [...itemList].sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1
            }
            return a.name.localeCompare(b.name)
        })
    }, [itemList])
    const [checkedFiles, setCheckedFiles] = useState<FileSystemEntry[]>([]);
    return (
        <div className="w-full h-full fixed bg-black/50 left-0 z-10" onClick={() => setItemList(null)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[rgb(var(--mdui-color-surface-container-highest))] rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <span className="text-[gray] ml-3 text-bold">勾选需要上传的文件</span>
                <mdui-list className="overflow-y-scroll h-10/12">
                    {sortedList.map((item) => <FileItem file={item} key={item.name} checkedFiles={checkedFiles} setCheckedFiles={setCheckedFiles} />)}
                </mdui-list>
                <div className="flex mt-2 justify-end mr-4 gap-1">
                    <mdui-button variant="text" onClick={() => setItemList(null)}>取消</mdui-button>
                    <mdui-button variant="text" onClick={() => {
                        console.log(checkedFiles);
                    }}>发送</mdui-button>
                </div>
            </div>
        </div>
    )
}