function useMainWindowIpc() {
    return {
        closeApplication: window.electronMainProcess.closeApplication,
        rebootApplication: window.electronMainProcess.rebootApplication,
        setEventHandle:window.electronMainProcess.setEventHandle,
    }
}
export default useMainWindowIpc;