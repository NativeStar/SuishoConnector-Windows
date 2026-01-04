import { useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import type { TransmitMessageListDispatch } from "../TransmitPage";
import type useDatabase from "~/hooks/useDatabase";
import type { TransmitTextMessage } from "~/types/database";
import type { VirtuosoHandle } from "react-virtuoso";
interface TransmitTextInputAreaProps {
    messageDispatch: React.ActionDispatch<TransmitMessageListDispatch>,
    database: ReturnType<typeof useDatabase<"transmit">>,
    list:React.RefObject<VirtuosoHandle | null>
}
export default function TransmitTextInputArea({ messageDispatch, database ,list}: TransmitTextInputAreaProps) {
    function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.ctrlKey && event.key === "Enter") {
            sendTextMessage()
            return
        }
    }
    function sendTextMessage() {
        if (text.replaceAll(" ", "") === "") {
            return
        }
        ipc.sendPacket({ packetType: "transmit_text", msg: text });
        const messageObject:TransmitTextMessage = {
            timestamp: Date.now(),
            type: "text",
            from: "computer",
            message: text,
        }
        messageDispatch({
            type: "add",
            messageInstance: messageObject
        });
        database.addData(messageObject)
        setText("");
        list.current?.scrollToIndex({ index: "LAST",align:"end",behavior:"smooth" });
    }
    const ipc = useMainWindowIpc();
    const [text, setText] = useState("");
    return (
        <>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="transmitInputArea bg-[rgb(var(--mdui-color-surface))] text-[rgb(var(--mdui-color-on-surface))] pl-0.5 pb-9 text-[0.7rem] w-[68%] h-[65%] ml-[1.8%] resize-none overflow-auto focus:border-2 focus:outline-none"
                // className="transmitInputArea bg-white pl-0.5 pb-9 text-[0.7rem] w-[68%] h-[65%] ml-[1.8%] resize-none overflow-auto focus:border-2 focus:outline-none"
                rows={2}
                cols={50}
                onKeyDownCapture={handleTextareaKeyDown}
                placeholder="在此输入文本
使用组合键(Ctrl+Enter)或点击右侧按钮发送"
                spellCheck={false} />
            <mdui-button variant="tonal" className="ml-2.5 mt-1" onClick={() => sendTextMessage()}>
                <img src="./send.svg" className="ml-1" />
            </mdui-button>
        </>
    )
}