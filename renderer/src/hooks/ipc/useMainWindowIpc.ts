import { useEffect, useRef } from "react";
interface IpcEvents {
    updateDeviceState: { batteryLevel: number, memInfo: { total: number, avail: number }, batteryTemp: number, charging: boolean };
    updateNetworkLatency:number
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
    }
}
export default useMainWindowIpc;