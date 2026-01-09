import { AppBar } from "~/components/AppBar";
import { useEffect, useRef, useState } from "react";
import { ConnectQrcode } from "./components/ConnectQrcode";
import useDevMode from "~/hooks/useDevMode";
import { type InitServerResult } from "~/types/ipc"
import * as mdui from "mdui";
import "mdui/mdui.css"
import "~/styles/global.css"
import "~/styles/outline_icon.css"
import "~/styles/blockWebAction.css"
import 'mdui/components/icon';
import "mdui/components/tooltip"
import "mdui/components/button-icon"
import useConnectPhoneWindowIpc from "~/hooks/ipc/useConnectPhoneWindowIpc";
import { QRCodeSVG } from "qrcode.react";
import useLogger from "~/hooks/useLogger";
export default function ConnectPhone() {
    useLogger();
    useDevMode();
    const connectPhoneWindowIpc = useConnectPhoneWindowIpc();
    const [qrcodeData, setQrcodeData] = useState<Omit<InitServerResult,"pairCode"> | null>(null);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [autoConnectorWorking, setAutoConnectorWorking] = useState<boolean>(false);
    const [isAutoConnectorError, setIsAutoConnectorError] = useState<boolean>(false);
    const [inApkDownloadPage, setInApkDownloadPage] = useState<boolean>(false);
    const pairCode=useRef<string>("");
    //连接相关初始化
    useEffect(() => {
        connectPhoneWindowIpc.initServer().then(value => {
            //异常检测
            if (value instanceof Error) {
                mdui.alert({
                    headline: "发生异常",
                    description: "初始化失败 可能是启用了虚拟网卡(TUN)类程序\n" + value.stack,
                    confirmText: "重启",
                    onConfirm: () => connectPhoneWindowIpc.rebootApplication(),
                });
                console.error(value);
                return
            }
            const { pairCode:code, ...data } = value;
            //空地址检测
            if (data.address === null) {
                mdui.alert({
                    headline: "发生异常",
                    description: "无法获取本机IP地址\n请检查网卡及网络连接是否正常\n或向开发者反馈此问题",
                    confirmText: "重启",
                    onConfirm: () => connectPhoneWindowIpc.rebootApplication(),
                });
                return
            }
            pairCode.current=code
            setQrcodeData(data)
        });
        connectPhoneWindowIpc.getBoundDeviceId().then(value => {
            if (value !== null) {
                connectPhoneWindowIpc.startAutoConnectBroadcast();
                setAutoConnectorWorking(true)
            }
        })
    }, []);
    //环境检测
    useEffect(() => {
        (async () => {
            if (await connectPhoneWindowIpc.detectProxy()) {
                mdui.confirm({
                    headline: "检测到系统代理",
                    description: "应用可能无法正常工作\n请检查代理设置",
                    confirmText: "打开设置",
                    cancelText: "确认",
                    onConfirm: () => {
                        connectPhoneWindowIpc.openProxySetting();
                    },
                }).catch(() => { })
            }
        })();
    }, []);
    //回调
    connectPhoneWindowIpc.on("connected", () => {
        setIsConnecting(true);
    });
    connectPhoneWindowIpc.on("connectFailed", (_event: never, reason: string, title: string = "连接失败") => {
        mdui.alert({
            headline: title,
            description: reason,
            confirmText: "重启",
            onConfirm: () => connectPhoneWindowIpc.rebootApplication(),
        });
    });
    connectPhoneWindowIpc.on("autoConnectorError", () => {
        setIsAutoConnectorError(true);
    });
    function openProjectUrl() {
        connectPhoneWindowIpc.openUrl("https://github.com/NativeStar/SuishoConnector-Windows");
    }
    function showManualConnectDialog() {
        // 39865固定的手动连接中转端口
        mdui.alert({
            headline: "手动连接",
            description: `请在手机端对应位置内输入以下信息\n
            IP:${qrcodeData?.address ?? "发生异常!"}\n
            端口:39865
            配对码:${pairCode.current}`,
            confirmText: "确定"
        })
    }
    return (
        <>
            <AppBar paddingLeft="4.5%"/>
            {inApkDownloadPage ?
                // apk 下载页面
                <div className="fixed w-full h-[90%] flex justify-center items-center flex-col mt-8.5">
                    <h4 className="text-[gray] text-base font-bold">下载Android端</h4>
                    <small className="text-[gray] mt-6">确保手机和电脑在同一局域网下</small>
                    <small className="text-[gray] mt-0.5">使用浏览器扫描下方二维码下载</small>
                    <QRCodeSVG className="mt-6" value={`http://${qrcodeData?.address ?? "ERROR"}:25120/suishoPkgDownload`} size={150} bgColor="#fdf7fe" fgColor="#707070" />
                    <span className="text-[gray] mt-5">
                        或者手机访问官方
                        <a className="text-[gray] underline" style={{cursor:"pointer"}} onClick={openProjectUrl}> Github仓库 </a>
                        下载安卓端
                    </span>
                    <mdui-tooltip content="返回">
                        <mdui-button-icon className="mt-6" icon="close" onClick={() => setInApkDownloadPage(false)}></mdui-button-icon>
                    </mdui-tooltip>
                </div>
                :
                // 主页面
                <div className="flex justify-center items-center flex-col mt-[37.2%]">
                    <h4 className="text-[gray] text-base font-bold">使用手机端扫码连接</h4>
                    <small className="text-[gray] mt-5">需要处在同一局域网下</small>
                    <br />
                    {qrcodeData !== null && <ConnectQrcode data={JSON.stringify(qrcodeData)} showMark={isConnecting} />}
                    {/* 自动连接 */}
                    {autoConnectorWorking && <div hidden={false} className="text-[gray] flex w-max mt-6.5">
                        <mdui-icon name={isAutoConnectorError ? "error_outline" : "cell_tower"} />
                        <span className="ml-0.5">{isAutoConnectorError ? "自动连接功能异常!" : "正在搜索绑定的设备..."}</span>
                    </div>}
                    {/* 菜单 */}
                    <div className="flex mt-19">
                        <mdui-tooltip content="手动连接">
                            <mdui-button-icon icon="support" onClick={showManualConnectDialog}></mdui-button-icon>
                        </mdui-tooltip>
                        <mdui-tooltip content="刷新">
                            <mdui-button-icon icon="refresh" onClick={() => connectPhoneWindowIpc.rebootApplication()}></mdui-button-icon>
                        </mdui-tooltip>
                        <mdui-tooltip content="安卓端下载">
                            <mdui-button-icon icon="download" onClick={() => {
                                connectPhoneWindowIpc.startApkDownloadServer();
                                setInApkDownloadPage(true);
                            }}></mdui-button-icon>
                        </mdui-tooltip>
                        <mdui-tooltip content="帮助">
                            <mdui-button-icon icon="help" onClick={() => alert("TODO")}></mdui-button-icon>
                        </mdui-tooltip>
                    </div>
                </div>}
        </>
    )
}