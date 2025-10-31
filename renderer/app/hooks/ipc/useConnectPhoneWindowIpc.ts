function useConnectPhoneWindowIpc() {
    return {
        isDeveloping: window.electronMainProcess.isDeveloping,
        devtools: window.electronMainProcess.devtools,
        rebootApplication: window.electronMainProcess.rebootApplication,
        detectProxy: window.electronMainProcess.detectProxy,
        openProxySetting: window.electronMainProcess.openProxySetting,
        initServer: window.electronMainProcess.initServer,
        on: (type: "connectFailed" | "connected" | "autoConnectorError", listener: Function) => {
            switch (type) {
                case "connected":
                    window.electronMainProcess.onPhoneConnected(listener);
                    break;
                case "connectFailed":
                    window.electronMainProcess.onPhoneConnectFailed(listener);
                    break;
                case "autoConnectorError":
                    window.electronMainProcess.autoConnectError(listener);
                    break;
                default:
                    throw new Error("Invalid event type");
            }
        },
        getBoundDeviceId:():Promise<null|string>=>window.electronMainProcess.getConfig("boundDeviceId") as Promise<null|string>,
        startAutoConnectBroadcast:window.electronMainProcess.startAutoConnectBroadcast,
        startApkDownloadServer:window.electronMainProcess.startApkDownloadServer,
    }
}
export default useConnectPhoneWindowIpc;