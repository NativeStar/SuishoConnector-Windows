import { useEffect } from "react";
import type { States } from "~/types/applicationState";
import type { NotificationItem } from "~/types/database";
import type { MediaSessionMetadata, MediaSessionState } from "~/types/ipc";
interface IpcEvents {
    updateDeviceState: { batteryLevel: number, memInfo: { total: number, avail: number }, batteryTemp: number, charging: boolean };
    updateNetworkLatency: number,
    editState: { type: "add" | "remove", id: States },
    trustModeChange: boolean,
    currentNotificationUpdate: { type: "add" | "remove", key: string, packageName: string, appName: string, title: string, content: string, time: number, ongoing: boolean,progress: number }
    rebootConfirm: void,
    closeConfirm: void,
    transmitAppendPlainText: string,
    transmitAppendFile: { displayName: string, size: number, fileName: string },
    transmitFileUploadSuccess: void,//那几个数据应该是用不上了
    transmitFileTransmitFailed: { title: string, message: string }
    disconnect?: string,
    showAlert: { title: string, content: string },
    notificationAppend: NotificationItem,
    focusNotification: void,
    transmitDragFile: { filename: string, filePath: string, size: number }
    updateDeepHideNotificationCache: { packageName: string, value: boolean }
    updateMediaSessionMetadata:MediaSessionMetadata
    updateMediaSessionPlaybackState:MediaSessionState
}
let registeredEventListener = false;
type EventListener = (...args: any[]) => void;
const listeners = new Map<string, Set<EventListener>>();
function eventHandle(_unused: never, event: string, ...args: any[]) {
    if (listeners.has(event)) {
        listeners.get(event)?.forEach(listener => listener(...args));
    }
}
function createListenerCleanup(event: string, callback: EventListener) {
    return () => {
        const listenersForEvent = listeners.get(event);
        if (!listenersForEvent) {
            return;
        }
        listenersForEvent.delete(callback);
        if (listenersForEvent.size === 0) {
            listeners.delete(event);
        }
    };
}
function registerListener(event: string, callback: EventListener) {
    if (!listeners.has(event)) {
        listeners.set(event, new Set<EventListener>());
    }
    listeners.get(event)!.add(callback);
    return createListenerCleanup(event, callback);
}
function useMainWindowIpc() {
    useEffect(() => {
        if (!registeredEventListener) {
            window.electronMainProcess.setEventHandle(eventHandle);
            registeredEventListener = true;
        }
    }, [])
    return {
        on<T extends keyof IpcEvents>(
            type: T,
            callback: (data: IpcEvents[T]) => void
        ): () => void {
            return registerListener(type, callback as EventListener);
        },
        closeApplication: window.electronMainProcess.closeApplication,
        rebootApplication: window.electronMainProcess.rebootApplication,
        getDeviceBaseInfo: window.electronMainProcess.getDeviceBaseInfo,
        getDeviceDetailInfo: window.electronMainProcess.getDeviceDetailInfo,
        sendPacket: window.electronMainProcess.sendPacket,
        sendRequestPacket: window.electronMainProcess.sendRequestPacket,
        getDeviceDataPath: window.electronMainProcess.getDeviceDataPath,
        registerFileUploadProgressListener: window.electronMainProcess.registerFileUploadProgressListener,
        unregisterFileUploadProgressListener: window.electronMainProcess.unregisterFileUploadProgressListener,
        openFile: window.electronMainProcess.openFile,
        openInExplorer: window.electronMainProcess.openInExplorer,
        getFilePath: window.electronMainProcess.getFilePath,
        transmitUploadFile: window.electronMainProcess.transmitUploadFile,
        createRightClickMenu: window.electronMainProcess.createRightClickMenu,
        openUrl: window.electronMainProcess.openUrl,
        generateTransmitFileURL: window.electronMainProcess.generateTransmitFileURL,
        getDeviceConfig: window.electronMainProcess.getDeviceConfig,
        startAuthorization: window.electronMainProcess.startAuthorization,
        openNotificationForwardConfigWindow: window.electronMainProcess.openNotificationForwardConfigWindow,
        getNotificationProfile: window.electronMainProcess.getNotificationProfile,
        getDeviceAllConfig: window.electronMainProcess.getDeviceAllConfig,
        getAllConfig: window.electronMainProcess.getAllConfig,
        setConfig: window.electronMainProcess.setConfig,
        setDeviceConfig: window.electronMainProcess.setDeviceConfig,
        deleteLogs: window.electronMainProcess.deleteLogs,
        getConfig: window.electronMainProcess.getConfig,
        createCredentials: window.electronMainProcess.createCredentials,
        checkAndroidClientPermission: window.electronMainProcess.checkAndroidClientPermission,
        getPhoneDirectoryFiles: window.electronMainProcess.getPhoneDirectoryFiles,
        downloadPhoneFile: window.electronMainProcess.downloadPhoneFile,
        getPhoneIp: window.electronMainProcess.getPhoneIp,
        appendMediaSessionControl: window.electronMainProcess.appendMediaSessionControl,
        setAudioForwardEnable:window.electronMainProcess.setAudioForwardEnable,
    }
}
export default useMainWindowIpc;
