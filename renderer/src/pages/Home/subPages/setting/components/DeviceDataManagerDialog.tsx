import { confirm, snackbar } from "mdui";
import { useCallback, useEffect, useState } from "react";
import ModalLayout from "~/components/ModalLayout";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import type { ConnectedDeviceHistoryList } from "~/types/ipc";
interface BoundDeviceManagerDialogProps {
    setVisibility: React.Dispatch<React.SetStateAction<boolean>>
    currentDeviceId: string
    boundDeviceId: string | null
}
export default function DeviceDataManagerDialog({ setVisibility, boundDeviceId, currentDeviceId }: BoundDeviceManagerDialogProps) {
    const ipc = useMainWindowIpc();
    const [deviceList, setDeviceList] = useState<ConnectedDeviceHistoryList[] | null>(null);
    useEffect(() => {
        //TODO 拉取indexedDb列表项合并显示 处理之前的bug
        ipc.getConnectedDevicesHistory().then(list => {
            setDeviceList(list);
        })
    }, []);
    const deleteDevice = useCallback(async (deviceId: string) => {
        confirm({
            headline: "确认删除设备?",
            description: "该设备的相关数据将被清空\n包括设置项 互传数据 资源缓存",
            confirmText: "确认",
            cancelText: "取消",
            onConfirm: async () => {
                const result = await ipc.deleteConnectedHistoryDeviceData(deviceId)
                snackbar({
                    message: result ? "删除成功" : "删除失败 详情请查看日志",
                    autoCloseDelay: result ? 1500 : 2750
                });
                setDeviceList(null);
                ipc.getConnectedDevicesHistory().then(list => {
                    setDeviceList(list);
                })
            }
        }).catch(() => { });
    }, [deviceList])
    return (
        <ModalLayout onLayoutClick={() => setVisibility(false)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[rgb(var(--mdui-color-surface-container-highest))] rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            {!deviceList&&<span className="text-[gray] absolute left-68 top-45">正在加载设备列表...</span>}
                {
                    deviceList && deviceList.map(deviceInfo => (
                        <mdui-list-item headline={deviceInfo.name ?? "未知名称"} description={`ID:${deviceInfo.id}`}>
                            <mdui-button variant="outlined" disabled={deviceInfo.id === currentDeviceId || deviceInfo.id === boundDeviceId} slot="end-icon" onClick={() => deleteDevice(deviceInfo.id)}>
                                {
                                    (() => {
                                        if (deviceInfo.id === currentDeviceId) {
                                            return "当前连接"
                                        } else if (deviceInfo.id === boundDeviceId) {
                                            return "已绑定"
                                        } else {
                                            return "删除"
                                        }
                                    })()
                                }
                            </mdui-button>
                        </mdui-list-item>
                    ))
                }
            </div>
        </ModalLayout>
    )
}