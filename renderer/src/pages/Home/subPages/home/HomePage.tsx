import { useEffect, useState } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import DeviceStateBar, { type DeviceState } from "./components/DeviceStateBar";
import type { StateAction, StatesListObject } from "../../Home";
import ApplicationStatesBar from "./components/ApplicationStatesBar";
import ActiveNotifications from "./components/ActiveNotifications";
import { confirm } from "mdui";
interface HomePageProps {
    hidden: boolean,
    applicationStates: StatesListObject,
    applicationStatesDispatch: React.ActionDispatch<StateAction>
}
export default function HomePage({ hidden ,applicationStates,applicationStatesDispatch}: HomePageProps) {
    const ipc = useMainWindowIpc();
    const [deviceName, setDeviceName] = useState<string>("");
    const [deviceState, setDeviceState] = useState<DeviceState>({
        memoryUsage: 0,
        batteryLevel: 0,
        batteryTemperature: 0,
        latency: 0,
        charging: false
    });
    useEffect(() => {
        ipc.getDeviceBaseInfo().then(value => {
            setDeviceName(value.model);
        });
        ipc.getDeviceDetailInfo().then(value => {
            setDeviceState(prevState => ({
                ...prevState,
                batteryLevel: value.batteryLevel,
                memoryUsage: ((value.memoryInfo.total - value.memoryInfo.avail) / value.memoryInfo.total) * 100
            }))
        })
        const updateDeviceStateCleanup=ipc.on("updateDeviceState", (value) => {
            setDeviceState(prevState => ({
                ...prevState,
                charging: value.charging,
                batteryLevel: value.batteryLevel,
                batteryTemperature: value.batteryTemp,
                memoryUsage: ((value.memInfo.total - value.memInfo.avail) / value.memInfo.total) * 100
            }))
        });
        const updateNetworkLatencyCleanup=ipc.on("updateNetworkLatency", value => {
            setDeviceState(prevState => ({ ...prevState, latency: value }))
        });
        const trustModeChangeCleanup=ipc.on("trustModeChange",(trusted)=>{
            applicationStatesDispatch({
                type:trusted?"remove":"add",
                id:"info_device_not_trusted"
            });
        });
        const editStateCleanup=ipc.on("editState",value=>{
            applicationStatesDispatch({type:value.type,id:value.id})
        });
        return ()=>{
            updateDeviceStateCleanup();
            updateNetworkLatencyCleanup();
            trustModeChangeCleanup();
            editStateCleanup();
        }
    }, []);
    return (
        <div style={{ display: hidden ? "none" : "block" }}>
            <h1 className="text-lg">{deviceName}</h1>
            <DeviceStateBar state={deviceState} />
            <ApplicationStatesBar states={applicationStates}/>
            <br />
            <ActiveNotifications/>
            <mdui-button className="mt-[35%]" onClick={()=>{
                confirm({
                        headline: "关闭程序",
                        description: "确认关闭程序?",
                        confirmText: "关闭",
                        cancelText: "取消",
                        onConfirm: () => {
                          ipc.closeApplication();
                        }
                      }).catch(() => { })
            }}>
                关闭程序
            </mdui-button>
        </div>
    )
}