import { useEffect, useState } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import DeviceStateBar, { type DeviceState } from "./components/DeviceStateBar";
import type { StateAction, StatesListObject } from "../../Home";
import ApplicationStatesBar from "./components/ApplicationStatesBar";
import ActiveNotifications from "./components/ActiveNotifications";
interface HomePageProps {
    hidden: boolean,
    applicationStates: StatesListObject,
    applicationStatesDispatch: React.ActionDispatch<StateAction>
}
export default function HomePage({ hidden ,applicationStates,applicationStatesDispatch}: HomePageProps) {
    const mainWindowIpc = useMainWindowIpc();
    const [deviceName, setDeviceName] = useState<string>("");
    const [deviceState, setDeviceState] = useState<DeviceState>({
        memoryUsage: 0,
        batteryLevel: 0,
        batteryTemperature: 0,
        latency: 0,
        charging: false
    });
    useEffect(() => {
        mainWindowIpc.getDeviceBaseInfo().then(value => {
            setDeviceName(value.model);
        });
        mainWindowIpc.getDeviceDetailInfo().then(value => {
            setDeviceState(prevState => ({
                ...prevState,
                batteryLevel: value.batteryLevel,
                memoryUsage: ((value.memoryInfo.total - value.memoryInfo.avail) / value.memoryInfo.total) * 100
            }))
        })
        const updateDeviceStateCleanup=mainWindowIpc.on("updateDeviceState", (value) => {
            setDeviceState(prevState => ({
                ...prevState,
                charging: value.charging,
                batteryLevel: value.batteryLevel,
                batteryTemperature: value.batteryTemp,
                memoryUsage: ((value.memInfo.total - value.memInfo.avail) / value.memInfo.total) * 100
            }))
        });
        const updateNetworkLatencyCleanup=mainWindowIpc.on("updateNetworkLatency", value => {
            setDeviceState(prevState => ({ ...prevState, latency: value }))
        });
        const trustModeChangeCleanup=mainWindowIpc.on("trustModeChange",(trusted)=>{
            applicationStatesDispatch({
                type:trusted?"remove":"add",
                id:"info_device_not_trusted"
            });
        });
        const editStateCleanup=mainWindowIpc.on("editState",value=>{
            console.log(value);
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
        </div>
    )
}