import { useContext, useEffect, useState } from "react"
import AndroidIdContext from "~/context/AndroidIdContext";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import DeviceStateBar, { type DeviceState } from "./components/DeviceStateBar";
// import { type ApplicationState, type States } from "~/types/applicationState";
import type { StateAction, StatesListObject } from "../../Home";
import ApplicationStatesBar from "./components/ApplicationStatesBar";
interface HomePageProps {
    hidden: boolean,
    applicationStates: StatesListObject,
    applicationStatesDispatch: React.ActionDispatch<StateAction>
}
export default function HomePage({ hidden ,applicationStates,applicationStatesDispatch}: HomePageProps) {
    const mainWindowIpc = useMainWindowIpc();
    const { setAndroidId } = useContext(AndroidIdContext);
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
            setAndroidId(value.androidId);
            setDeviceName(value.model);
        });
        mainWindowIpc.getDeviceDetailInfo().then(value => {
            setDeviceState(prevState => ({
                ...prevState,
                batteryLevel: value.batteryLevel,
                memoryUsage: ((value.memoryInfo.total - value.memoryInfo.avail) / value.memoryInfo.total) * 100
            }))
        })
        mainWindowIpc.on("updateDeviceState", (value) => {
            setDeviceState(prevState => ({
                ...prevState,
                charging: value.charging,
                batteryLevel: value.batteryLevel,
                batteryTemperature: value.batteryTemp,
                memoryUsage: ((value.memInfo.total - value.memInfo.avail) / value.memInfo.total) * 100
            }))
        });
        mainWindowIpc.on("updateNetworkLatency", value => {
            setDeviceState(prevState => ({ ...prevState, latency: value }))
        })
    }, []);

    return (
        <div style={{ display: hidden ? "none" : "block" }}>
            <h1 className="text-lg">{deviceName}</h1>
            <DeviceStateBar state={deviceState} />
            <button onClick={()=>{
                applicationStatesDispatch({
                    type:"add",
                    id:"DeviceNotTrusted"
                });
                applicationStatesDispatch({
                    type:"add",
                    id:"PhoneFileServer"
                });
            }}>add</button>
            <button onClick={()=>{
                applicationStatesDispatch({
                    type:"remove",
                    id:"DeviceNotTrusted"
                });
                applicationStatesDispatch({
                    type:"remove",
                    id:"PhoneFileServer"
                });
            }}>remove</button>
            <ApplicationStatesBar states={applicationStates}/>
            <br />
            
        </div>
    )
}