export default function useNotificationFilterWindowIpc() { 
    return {
        getTextFilterConfig:window.electronMainProcess.getTextFilterConfig,
        changeTextFilterMode:window.electronMainProcess.changeTextFilterMode,
        editTextFilterRule:window.electronMainProcess.editTextFilterRule,
        sendRequestPacket:window.electronMainProcess.sendRequestPacket,
        getDeviceDataPath:window.electronMainProcess.getDeviceDataPath,
        getNotificationProfile:window.electronMainProcess.getNotificationProfile,
        setNotificationProfile:window.electronMainProcess.setNotificationProfile,
        getPackageList:window.electronMainProcess.getPackageList,
        sendMessageToMainWindow:window.electronMainProcess.sendMessageToMainWindow
    }
}