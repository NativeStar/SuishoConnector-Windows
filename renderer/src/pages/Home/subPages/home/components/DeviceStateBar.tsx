export interface DeviceState{
    memoryUsage: number,
    batteryTemperature: number,
    batteryLevel: number,
    latency: number,
    charging: boolean
}
interface DeviceStateBarProps {
    state: DeviceState
}
export default function DeviceStateBar({ state }: DeviceStateBarProps) {
    return (
        <mdui-card className="inline-flex items-center pt-1 pr-0.5 pb-1 pl-0.5">
            {/* 内存占用 */}
            <mdui-icon name="memory"></mdui-icon>
            <span>{Math.ceil(state.memoryUsage)}%</span>
            {/* 电池温度 */}
            <mdui-icon name="thermostat"></mdui-icon>
            <span >{state.batteryTemperature/10}°C</span>
            {/* 电量和充电状态 */}
            <mdui-icon name={state.charging?"battery_charging_full":"battery_full"} id="batteryChargingIcon"></mdui-icon>
            <span>{state.batteryLevel}%</span>
            {/* 通讯延迟 */}
            <mdui-icon name="wifi"></mdui-icon>
            <span>{state.latency}ms</span>
        </mdui-card>
    )
}