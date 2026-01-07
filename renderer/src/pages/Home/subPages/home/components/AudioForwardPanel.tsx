import { snackbar, confirm } from "mdui";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
interface AudioForwardPanelProps {
    className?: string;
}
export default function AudioForwardPanel({ className }: AudioForwardPanelProps) {
    const ipc = useMainWindowIpc();
    const [forwarding, setForwarding] = useState(false);
    const [loading, setLoading] = useState(false);
    function onChangeButtonClick() {
        setLoading(true);
        if (!forwarding) {
            ipc.setAudioForwardEnable(true).then(value => {
                if (!value.result) {
                    snackbar({
                        message: value.exception ? `启动时发生异常:${value.exception}` : "功能涉及特殊权限 请先在Android设备上手动授权",
                        autoCloseDelay: 3000,
                        closeable: true
                    });
                    setLoading(false);
                    return
                }
                setForwarding(true);
                setLoading(false);
            })
            // })
        } else {
            confirm({
                headline: "关闭音频转发",
                description: "由于系统限制 关闭后如需再次打开该功能需要重新前往系统授权 确定关闭?",
                confirmText: "确定",
                cancelText: "取消",
                onConfirm() {
                    ipc.setAudioForwardEnable(false).then(() => {
                        setForwarding(false);
                        setLoading(false);
                    })
                },
                onCancel() {
                    setLoading(false);
                }
            })
        }
    }
    return (
        <mdui-card className={twMerge("fixed flex flex-col h-[10%] w-[34%]", className)}>
            <div className="flex items-center justify-between mt-2.5">
                <mdui-icon name={forwarding ? "volume_up" : "volume_off"} className="text-4xl ml-1" />
                <span className="text-[gray]">音频转发已{forwarding ? "开启" : "关闭"}</span>
                <mdui-button variant="tonal" loading={loading} disabled={loading} className="mr-1" onClick={onChangeButtonClick}>{forwarding ? "关闭" : "开启"}</mdui-button>
            </div>
        </mdui-card>
    )
}