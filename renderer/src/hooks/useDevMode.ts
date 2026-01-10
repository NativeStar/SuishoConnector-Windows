let init = false;
function useDevMode() {
    if (!init)
        window.electronMainProcess.isDeveloping().then(async (result: boolean) => {
            if (result) {
                console.info(`Enable debug mode hotkeys`);
                document.addEventListener("keydown", (event: KeyboardEvent) => {
                    if (event.key === "F5") {
                        window.location.reload()
                    } else if (event.key === "F12") {
                        window.electronMainProcess.devtools();
                    }
                });
                init = true;
            }
        })
}
export default useDevMode;