import { useEffect, useRef, useState } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import DeviceStatePanel, { type DeviceState } from "./components/DeviceStatePanel";
import type { StateAction, StatesListObject } from "../../Home";
import ApplicationStatesBar from "./components/ApplicationStatesBar";
import ActiveNotifications from "./components/ActiveNotifications";
import MediaControl from "./components/MediaControl";
import type { TrustModeIpc } from "~/types/ipc";
import { TrustMode } from "shared/const/TrustMode";
import AudioForwardPanel from "./components/AudioForwardPanel";
import DeviceInfoPanel from "./components/DeviceInfoPanel";
import FabMenu from "./components/FabMenu";
interface HomePageProps {
    hidden: boolean,
    applicationStates: StatesListObject,
    applicationStatesDispatch: React.ActionDispatch<StateAction>
}
export default function HomePage({ hidden, applicationStates, applicationStatesDispatch }: HomePageProps) {
    const ipc = useMainWindowIpc();
    const [deviceState, setDeviceState] = useState<DeviceState>({
        memoryUsage: 0,
        batteryLevel: 0,
        batteryTemperature: 0,
        latency: 0,
        charging: false
    });
    const batteryFullState = useRef(false);
    useEffect(() => {
        ipc.getDeviceDetailInfo().then(value => {
            setDeviceState(prevState => ({
                ...prevState,
                batteryLevel: value.batteryLevel,
                memoryUsage: ((value.memoryInfo.total - value.memoryInfo.avail) / value.memoryInfo.total) * 100
            }))
        })
        const updateDeviceStateCleanup = ipc.on("updateDeviceState", async (value) => {
            if (value.charging && value.batteryLevel === 100) {
                if (batteryFullState.current === false && await ipc.getDeviceConfig("enableBatteryFullNotification",false)) {
                    batteryFullState.current = true;
                    //直接用web自带足矣
                    new Notification("手机满电提醒", {
                        body: "设备电量已满"
                    });
                }
            } else {
                batteryFullState.current = false;
            }
            setDeviceState(prevState => ({
                ...prevState,
                charging: value.charging,
                batteryLevel: value.batteryLevel,
                batteryTemperature: value.batteryTemp,
                memoryUsage: ((value.memInfo.total - value.memInfo.avail) / value.memInfo.total) * 100
            }))
        });
        // 信任模式获取
        ipc.sendRequestPacket<TrustModeIpc>({ packetType: "main_getTrustMode"}).then(value=>{
            value.trustMode==TrustMode.UNTRUSTED && applicationStatesDispatch({
                type: "add",
                id: "info_device_not_trusted"
            });
        })
        const updateNetworkLatencyCleanup = ipc.on("updateNetworkLatency", value => {
            setDeviceState(prevState => ({ ...prevState, latency: value }))
        });
        const trustModeChangeCleanup = ipc.on("trustModeChange", (trusted) => {
            applicationStatesDispatch({
                type: trusted ? "remove" : "add",
                id: "info_device_not_trusted"
            });
        });
        const editStateCleanup = ipc.on("editState", value => {
            applicationStatesDispatch({ type: value.type, id: value.id })
        });
        return () => {
            updateDeviceStateCleanup();
            updateNetworkLatencyCleanup();
            trustModeChangeCleanup();
            editStateCleanup();
        }
    }, []);
    return (
        <div style={{ display: hidden ? "none" : "block" }}>
            <DeviceInfoPanel className="top-[9.5%]"/>
            <DeviceStatePanel state={deviceState} className="top-[42.5%]"/>
            <ActiveNotifications className="top-[46%] left-[45%]"/>
            <ApplicationStatesBar states={applicationStates} className="top-[9%] right-[2.3%]"/>
            <MediaControl className="right-[15%] top-[9.5%]"/>
            <AudioForwardPanel className="top-[68.5%] left-[10%]"/>
            <FabMenu className="bottom-[2.5%] right-[2.5%]"/>
        </div>
    )
}