import { useState } from "react";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
// import {snackbar} from "mdui/functions/snackbar"
//打开debug面板
let codeIndex=0;
const konamiCode = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a"
];
export default function TransmitTextInputArea() {
    function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.ctrlKey&&event.key==="Enter") {
            sendTextMessage()
            return
        }
        if (event.key === konamiCode[codeIndex]) {
            codeIndex++;
            if (codeIndex === konamiCode.length) {
                codeIndex = 0;
                ipc.openDebugPanel();
            }
        } else {
            codeIndex = 0;
        }
    }
    function sendTextMessage() {
        if (text.replaceAll(" ", "") === "") {
            return
        }
        setText("");
    }
    const ipc=useMainWindowIpc();
    const [text, setText] = useState("");
    return (
        <>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="transmitInputArea bg-white pl-0.5 pb-9 text-[0.7rem] w-[68%] h-[65%] mt-[0.8%] ml-[1.8%] resize-none overflow-auto focus:border-2 focus:outline-none"
                rows={2}
                cols={50}
                onKeyDownCapture={handleTextareaKeyDown}
                placeholder="在此输入文本
使用组合键(Ctrl+Enter)或点击右侧按钮发送"
                spellCheck={false} />
            <mdui-button variant="tonal" className="ml-2.5 mt-1" onClick={() => sendTextMessage()}>
                <img src="./send.svg" className="ml-1"/>
            </mdui-button>
        </>
    )
}