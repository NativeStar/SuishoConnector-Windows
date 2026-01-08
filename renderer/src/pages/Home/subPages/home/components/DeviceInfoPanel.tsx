import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import type { DeviceBaseInfo } from "~/types/ipc";
import {getAndroidVersionInfoBySdkVersion} from "~/utils"
interface DeviceInfoPanelProps {
    className?: string
}
export default function DeviceInfoPanel({className}:DeviceInfoPanelProps) {
    const ipc=useMainWindowIpc();
    const [androidVersionDisplay, setAndroidVersionDisplay]=useState<string>("Loading");
    const [deviceInfo, setDeviceInfo]=useState<DeviceBaseInfo>({
        androidSdkVersion: 0,
        androidId: "failed",
        model: "Loading",
        oem: "Loading",
        protocolVersion: 1,
        sessionId: "Loading"
    });
    useEffect(() => { 
        ipc.getDeviceBaseInfo().then(v=>{
            setDeviceInfo(v)
            const androidVersionInfo=getAndroidVersionInfoBySdkVersion(v.androidSdkVersion);
            setAndroidVersionDisplay(`${androidVersionInfo.semver}-${androidVersionInfo.name}`);
        });
    }, []);
    return (
        <mdui-card className={twMerge("fixed flex flex-col h-[32%] w-[34%]",className)}>
            <small className="text-[gray] ml-1 mt-1">设备信息</small>
            <mdui-divider/>
            <div className="flex mt-1.5 ml-1">
                <mdui-icon name="propane" />
                <small className="text-[gray] mt-1">厂商:  {deviceInfo.oem}</small>
            </div>
            <div className="flex mt-2 ml-1">
                <mdui-icon name="phone_android" />
                <small className="text-[gray] mt-1">型号:  {deviceInfo.model}</small>
            </div>
            <div className="flex mt-2 ml-1">
                <mdui-icon name="android" />
                <small className="text-[gray] mt-1">系统版本:  {androidVersionDisplay}</small>
            </div>
            <div className="flex mt-2 ml-1">
                <mdui-icon name="tag" />
                <small className="text-[gray] mt-1">设备ID:  {deviceInfo.androidId}</small>
            </div>
            <div className="flex mt-2 ml-1">
                <mdui-icon name="diversity_2" />
                <small className="text-[gray] mt-1">协议版本:  {deviceInfo.protocolVersion}</small>
            </div>
        </mdui-card>
    )
}