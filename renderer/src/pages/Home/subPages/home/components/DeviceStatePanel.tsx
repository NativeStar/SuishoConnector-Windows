import { twMerge } from "tailwind-merge"

export interface DeviceState{
    memoryUsage: number,
    batteryTemperature: number,
    batteryLevel: number,
    latency: number,
    charging: boolean
}
interface DeviceStateBarProps {
    state: DeviceState
    className?: string
}
export default function DeviceStatePanel({ state ,className}: DeviceStateBarProps) {
    return (
        <mdui-card className={twMerge("fixed flex flex-col h-[25%] w-[34%]",className)}>
            <small className="text-[gray] ml-1 mt-1">设备状态</small>
            <mdui-divider/>
            <div className="flex mt-1.5 ml-1">
                <mdui-icon name="memory" />
                <small className="text-[gray] mt-0.5">内存占用:   {Math.ceil(state.memoryUsage)}%</small>
            </div>
            <div className="flex mt-1.5 ml-1">
                <mdui-icon name="thermostat" />
                <small className="text-[gray] mt-0.5">电池温度:   {state.batteryTemperature/10}°C</small>
            </div>
            <div className="flex mt-1.5 ml-1">
                <mdui-icon name={state.charging?"battery_charging_full":"battery_full"} />
                <small className="text-[gray] mt-0.5">电池电量:   {state.batteryLevel}% {state.charging&&"(充电中)"}</small>
            </div>
            <div className="flex mt-1.5 ml-1">
                <mdui-icon name="wifi" />
                <small className="text-[gray] mt-0.5">通讯延迟:   {state.latency}ms</small>
            </div>
        </mdui-card>
    )
}