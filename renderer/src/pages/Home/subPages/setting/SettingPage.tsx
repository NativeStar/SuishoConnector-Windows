import "mdui/components/list-subheader"
import SettingItemCommon from "./components/SettingItemCommon"
import SettingItemSelect from "./components/SettingItemSelect"
import { authMethodOptions, heartbeatDelayOptions, logLevelOptions, notificationShowMethodOptions } from "./optionsList"
import SettingItemSwitch from "./components/SettingItemSwitch"
import { useContext, useEffect, useState } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import AndroidIdContext from "~/context/AndroidIdContext"
import { onBoundDeviceItemClick, onChangePasswordItemClick, onDeleteLogsItemClick, onProtectMethodChange, rebootSnackbar } from "./settingActionHandles"
import type { ProtectMethod } from "~/utils"
import AboutDialog from "./components/AboutDialog"
import { alert } from "mdui"
interface SettingPageProps {
    hidden: boolean
}
export default function SettingPage({ hidden }: SettingPageProps) {
    const ipc = useMainWindowIpc();
    const { androidId } = useContext(AndroidIdContext)
    const [deviceConfig, setDeviceConfig] = useState<{ [key: string]: string | number | boolean; }>({});
    const [applicationConfig, setApplicationConfig] = useState<{ [key: string]: string | number | boolean; }>({});
    const [boundDeviceId, setBoundDeviceId] = useState<string | null>(null);
    const [showAboutDialog, setShowAboutDialog] = useState(false);
    useEffect(() => {
        ipc.getDeviceAllConfig().then(res => {
            setDeviceConfig(res);
        });
        // TODO 等后面更新到东西再改了
        ipc.getAllConfig().then(res => {
            setBoundDeviceId(res.boundDeviceId as string);
            setApplicationConfig(res);
        });
    }, []);
    //便于在需要时disabled组件
    function wrappedSetDeviceConfig(key: string, value: string | number | boolean){
        setDeviceConfig({
            ...deviceConfig,
            [key]:value
        });
        ipc.setDeviceConfig(key,value);
    }
    function onLogLevelChangeTip(value:string){
        if (value === "DEBUG") {
            alert({
                headline:"调试日志提醒",
                description:"该等级日志详细程度较高 可能造成额外的性能消耗和磁盘占用 仅建议在需要反馈问题或开发时使用 (重启后生效)",
                confirmText:"确定",
            }).catch(()=>{});
            return
        }
        rebootSnackbar();
    }
    return (
        <>
            { showAboutDialog && <AboutDialog setVisible={setShowAboutDialog}/>}
            <div style={{ display: hidden ? "none" : "block" }} className="flex flex-col h-full overflow-y-scroll">
                <mdui-list>
                    <mdui-list-subheader className="ml-5 h-10 font-bold">全局</mdui-list-subheader>
                    <SettingItemCommon title="绑定/解绑设备" onClick={() => onBoundDeviceItemClick(androidId, boundDeviceId, setBoundDeviceId, deviceConfig, ipc)} desc={boundDeviceId ? `已绑定设备ID:${boundDeviceId}` : "未绑定"} icon="link" />
                    <SettingItemSelect title="掉线轮询间隔" icon="monitor_heart" desc="降低设备掉线时反应时间 可能影响手机耗电量" items={heartbeatDelayOptions} configs={applicationConfig} setConfig={ipc.setConfig} configKey="heartBeatDelay" onChange={rebootSnackbar} />
                    <SettingItemSelect title="日志输出等级" desc="方便调试 可能对性能有微弱影响" icon="library_books" items={logLevelOptions} configs={applicationConfig} setConfig={ipc.setConfig} configKey="logLevel" onChange={onLogLevelChangeTip} />
                    <SettingItemSwitch title="自动检查更新" desc="在连接设备后联网检查软件更新" icon="update" configs={applicationConfig} configKey="autoCheckUpdate" setConfig={ipc.setConfig} />
                    <mdui-list-subheader className="ml-5 h-10 font-bold">通知转发</mdui-list-subheader>
                    <SettingItemSwitch title="启用通知转发" icon="fork_right" configs={deviceConfig} configKey="enableNotificationForward" setConfig={wrappedSetDeviceConfig} />
                    <SettingItemSwitch title="计算机锁屏后继续推送通知" desc="即使计算机锁屏也会弹出通知(锁屏时通知内容可能被系统隐藏)" icon="close_fullscreen" configs={deviceConfig} configKey="pushNotificationOnLockedScreen" setConfig={wrappedSetDeviceConfig} />
                    <SettingItemSwitch title="解锁后提醒接收的通知数量" desc="如果在计算机锁屏时接收到转发通知 则会在解锁后发起提醒 避免遗漏(仅在关闭'计算机锁屏后继续推送通知'时生效)" icon="sync_lock" configs={deviceConfig} configKey="showBlockedNotificationCountOnUnlockScreen" setConfig={wrappedSetDeviceConfig} disabled={deviceConfig.pushNotificationOnLockedScreen as boolean}/>
                    <SettingItemSwitch title="手机使用时计算机不推送通知" desc="避免使用手机时通知重复推送 数据仍会进行记录(以是否解锁屏幕为依据判断使用状态)" icon="phonelink_lock" configs={deviceConfig} configKey="blockNotificationOnDeviceUnlock" setConfig={wrappedSetDeviceConfig}/>
                    <SettingItemSwitch title="全屏时推送通知" desc="全屏视频 游戏 PPT等" icon="fullscreen" configs={deviceConfig} configKey="pushNotificationOnFullScreen" setConfig={wrappedSetDeviceConfig} />
                    <SettingItemSwitch title="使用通知历史记录" icon="history" configs={deviceConfig} configKey="enableNotificationLog" setConfig={wrappedSetDeviceConfig} />
                    <SettingItemSelect title="默认通知展示方式" icon="notifications_active" items={notificationShowMethodOptions} configs={deviceConfig} configKey="defaultNotificationShowMode" setConfig={wrappedSetDeviceConfig} />
                    <mdui-list-subheader className="ml-5 h-10 font-bold">隐私</mdui-list-subheader>
                    <SettingItemSelect title="验证方式" icon="key" items={authMethodOptions} onChange={async (value) => onProtectMethodChange(value as ProtectMethod, ipc, androidId)} configKey="protectMethod" configs={deviceConfig} setConfig={wrappedSetDeviceConfig} />
                    <SettingItemSwitch title="通知转发记录保护" icon="doorbell" configs={deviceConfig} configKey="protectNotificationForwardPage" setConfig={wrappedSetDeviceConfig} />
                    <SettingItemCommon title="更改密码" icon="link" onClick={() => onChangePasswordItemClick(androidId, deviceConfig, ipc)} />
                    <SettingItemSwitch title="截录屏保护" desc="阻止截图录屏获取软件内容保护隐私 适用于直播或屏幕共享等" icon="shield" configs={applicationConfig} configKey="enableContentProtection" setConfig={ipc.setConfig} />
                    <mdui-list-subheader className="ml-5 h-10 font-bold">辅助功能</mdui-list-subheader>
                    <SettingItemSwitch title="电池满电提醒" desc="手机电量充满时发出通知" icon="battery_4_bar" configs={deviceConfig} configKey="enableBatteryFullNotification" setConfig={wrappedSetDeviceConfig} />
                    <mdui-list-subheader className="ml-5 h-10 font-bold">杂项</mdui-list-subheader>
                    <SettingItemCommon title="关于" icon="info" onClick={() => setShowAboutDialog(true)} />
                    <SettingItemCommon title="清除日志" icon="delete_sweep" onClick={() => onDeleteLogsItemClick(ipc)} />
                </mdui-list>
            </div>
        </>
    )
}