import { twMerge } from "tailwind-merge";
import type { TransmitFileMessage } from "~/types/database";
import { parseFileSize } from "~/utils";
import "mdui/components/linear-progress"
import { useEffect, useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import type useDatabase from "~/hooks/useDatabase";
import type { TransmitMessageListDispatch } from "../TransmitPage";
interface TextMessageProps {
    text: string,
    from: "phone" | "computer"
}
interface FileMessageProps {
    data:TransmitFileMessage,
    progressing:boolean,
    database:ReturnType<typeof useDatabase<"transmit">>,
    messageDispatch:React.ActionDispatch<TransmitMessageListDispatch>
}
export function TextMessage({ text, from }: TextMessageProps) {
    return (
        <mdui-card className={twMerge("w-10/12 mt-1", from === "phone" ? "bg-[#ede7ed]" : "bg-[#f3ebf3] ml-28")} variant="filled">
            <div className="whitespace-normal wrap-break-word text-wrap pl-2 pt-0.5 pb-0.5">
                {text}
            </div>
        </mdui-card>
    )
}
export function FileMessage({data,progressing:hasProgress,database,messageDispatch}:FileMessageProps) {
    const ipc=useMainWindowIpc();
    const [progressValue,setProgressValue] = useState<number>(0);
    const [progressing,setProgressing] = useState<boolean>(hasProgress);
    const [isDeleted,setIsDeleted] = useState<boolean>(data.isDeleted);
    useEffect(()=>{
        const progressListener=(_event:never,progress:number)=>{
            setProgressValue(progress);
        }
        if (hasProgress) {
            ipc.registerFileUploadProgressListener(progressListener);
            ipc.on("transmit_fileUploadSuccess",()=>{
                //进度条消失之前填满
                setProgressValue(data.size);
                setProgressing(false);
                ipc.unregisterFileUploadProgressListener(progressListener);
            });
            ipc.on("transmit_fileTransmitFailed",()=>{
                setProgressing(false);
                ipc.unregisterFileUploadProgressListener(progressListener);
            })
            return ()=>{
                ipc.unregisterFileUploadProgressListener(progressListener);
            }
        }
    },[]);
    function openFile(){
        if (data.from==="computer") return
        ipc.openFile(data.name).then(result=>{
            if (!result) {
                setIsDeleted(true);
                const modifiedData = {...data,isDeleted:true}
                messageDispatch({
                    type:"put",
                    timestamp:modifiedData.timestamp,
                    messageInstance:{...data,isDeleted:true}
                });
                database.putData(modifiedData);
            }
        })
    }
    return (
        <mdui-card onClick={openFile} clickable={!isDeleted&&data.from==="phone"} className={twMerge("mdui-theme-auto w-65 h-23.5 rounded-[9px] mt-1 whitespace-pre-wrap text-ellipsis",data.from==="phone"?"bg-[#ede7ed]":"bg-[#f3ebf3] ml-110")} variant="elevated">
            <img src="/transmit_file_default.png" className="w-[32%] h-[85%] float-left mt-1.5"/>
            <div className="flex flex-col" style={{cursor:isDeleted||data.from==="computer"?"default":"pointer"}}>
                <b className="whitespace-nowrap text-ellipsis overflow-hidden mt-1.5 ml-15px" style={{cursor:isDeleted||data.from==="computer"?"default":"pointer"}}>{data.displayName}</b>
                <div className={twMerge("mt-5",isDeleted?"text-red-500":"")} style={{cursor:isDeleted||data.from==="computer"?"default":"pointer"}}>{isDeleted?"文件被删除":parseFileSize(data.size)}</div>
                {progressing&&<mdui-linear-progress max={data.size} value={progressValue} className="mt-2 w-11/12"/>}
            </div>
        </mdui-card>
    )
}