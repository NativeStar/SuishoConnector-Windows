import { QRCodeSVG } from "qrcode.react";
import "mdui/components/circular-progress"
import { useEffect, useState } from "react";
interface ConnectQrcodeProps {
    data: string,
    showMark: boolean
}
export function ConnectQrcode({ data, showMark }: ConnectQrcodeProps) {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });
    useEffect(() => {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
            setIsDarkMode(e.matches);
        });
    }, []);
    return (
        <>
            {showMark &&
                <div className="opacity-75 size-43.75 bg-white z-10 absolute text-center top-[35.5%]">
                    <mdui-circular-progress className="fixed top-[45%] left-[44.5%]" />
                    <span className="absolute left-[35.5%] top-[58%]">连接中...</span>
                </div>
            }
            {/* 连接中遮罩 */}
            {/* 二维码 隐藏在上方的鼠标指针避免影响扫码*/}
            <QRCodeSVG
                className="mt-1.5 hover:cursor-none"
                value={data}
                marginSize={isDarkMode ? 1 : 0}//避免深色模式下影响识别
                size={175}
                bgColor={isDarkMode ? "#f6f2f7" : "#fdf7fe"}
                fgColor={isDarkMode ? "#1f1f1f" : "#707070"} />
        </>
    )
}