import useConnectPhoneWindowIpc from "./ipc/useConnectPhoneWindowIpc";

function useDevMode() {
    const { isDeveloping} = useConnectPhoneWindowIpc();
    isDeveloping().then(async (result: boolean) => {
        if (result) {
            document.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.key === "F5") {
                    window.location.reload()
                } else if (event.key === "F12") {
                    window.electronMainProcess.devtools();
                }
            });
        }
    })
    return null;
}
export default useDevMode;