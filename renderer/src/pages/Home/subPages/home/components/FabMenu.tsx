import { twMerge } from "tailwind-merge";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import { confirm } from "mdui"
interface FabMenuProps {
    className?: string;
}
export default function FabMenu({ className }: FabMenuProps) {
    const ipc = useMainWindowIpc();
    function onCloseItemClick() {
        console.debug("Show close application dialog by fab menu");
        confirm({
            headline: "关闭程序",
            description: "确认关闭程序?",
            confirmText: "关闭",
            cancelText: "取消",
            onConfirm: () => {
                ipc.closeApplication();
            }
        }).catch(() => { });
    }
    function onRebootItemClick() {
        console.debug("Show reboot application dialog by fab menu");
        confirm({
            headline: "重启程序",
            description: "确认重启程序?",
            confirmText: "重启",
            cancelText: "取消",
            onConfirm: () => {
                ipc.rebootApplication();
            }
        }).catch(() => { })
    }
    return (
        <mdui-dropdown>
            <mdui-fab extended className={twMerge("fixed", className)} icon="menu_open" slot="trigger">菜单</mdui-fab>
            <mdui-menu>
                <mdui-menu-item icon="refresh" onClick={onRebootItemClick}>重启程序</mdui-menu-item>
                <mdui-menu-item icon="close" onClick={onCloseItemClick}>关闭程序</mdui-menu-item>
            </mdui-menu>
        </mdui-dropdown>
    )
}