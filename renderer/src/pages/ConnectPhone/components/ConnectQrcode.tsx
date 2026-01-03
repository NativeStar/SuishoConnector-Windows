import { QRCodeSVG } from "qrcode.react";
import "mdui/components/circular-progress"
interface ConnectQrcodeProps {
    data: string,
    showMark: boolean
}
export function ConnectQrcode({ data, showMark }: ConnectQrcodeProps) {
    return (
        <>
            {showMark &&
                <div className="opacity-75 size-[175px] bg-white z-10 absolute text-center top-[36%]">
                    <mdui-circular-progress className="fixed top-[45%] left-[44.5%]"/>
                    <span className="absolute left-[35.5%] top-[58%]">连接中...</span>
                </div>
            }
            {/* 连接中遮罩 */}
            {/* 二维码 隐藏在上方的鼠标指针避免影响扫码*/}
            <QRCodeSVG className="mt-1.5 hover:cursor-none" value={data} size={175} bgColor="#fdf7fe" fgColor="#707070" />
        </>
    )
}