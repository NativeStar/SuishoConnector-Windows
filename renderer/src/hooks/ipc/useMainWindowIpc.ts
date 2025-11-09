import { useEffect, useRef } from "react";
import type { States } from "~/types/applicationState";
interface IpcEvents {
    updateDeviceState: { batteryLevel: number, memInfo: { total: number, avail: number }, batteryTemp: number, charging: boolean };
    updateNetworkLatency: number,
    editState: { type: "add" | "remove", id: States },
    trustModeChange: boolean,
    currentNotificationUpdate: { type: "add" | "remove", key: string, packageName: string, appName: string, title: string, content: string, time: number, ongoing: boolean }
}
function useMainWindowIpc() {
    const listenersRef = useRef(new Map<string, Function[]>());
    useEffect(() => {
        function handle(_unused: never, event: string, ...args: any[]) {
            if (listenersRef.current.has(event)) {
                listenersRef.current.get(event)?.forEach(listener => listener(...args));
            }
        }
        window.electronMainProcess.setEventHandle(handle)
        return () => {
            window.electronMainProcess.removeEventHandle(handle);
            listenersRef.current.clear();
        }
    }, [])
    return {
        on<T extends keyof IpcEvents>(
            type: T,
            callback: (data: IpcEvents[T]) => void
        ): void {
            if (listenersRef.current.has(type)) {
                const tmpListenersList = listenersRef.current.get(type)!;
                tmpListenersList?.push(callback);
                listenersRef.current.set(type, tmpListenersList);
            } else {
                listenersRef.current.set(type, [callback]);
            }
        },
        closeApplication: window.electronMainProcess.closeApplication,
        rebootApplication: window.electronMainProcess.rebootApplication,
        getDeviceBaseInfo: window.electronMainProcess.getDeviceBaseInfo,
        getDeviceDetailInfo: window.electronMainProcess.getDeviceDetailInfo,
        sendPacket: window.electronMainProcess.sendPacket,
        sendRequestPacket: window.electronMainProcess.sendRequestPacket,
        getDeviceDataPath: window.electronMainProcess.getDeviceDataPath,
    }
}
export default useMainWindowIpc;