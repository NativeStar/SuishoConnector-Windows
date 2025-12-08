import "mdui/components/list-subheader"
import SettingItemCommon from "./components/SettingItemCommon"
import SettingItemSelect from "./components/SettingItemSelect"
import { authMethodOptions, heartbeatDelayOptions, logLevelOptions, notificationShowMethodOptions } from "./optionsList"
import SettingItemSwitch from "./components/SettingItemSwitch"
import { useContext, useEffect, useState } from "react"
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import AndroidIdContext from "~/context/AndroidIdContext"
import { onBoundDeviceItemClick, onChangePasswordItemClick, onDeleteLogsItemClick, rebootSnackbar } from "./settingActionHandles"
interface SettingPageProps {
    hidden: boolean
}
export default function SettingPage({ hidden }: SettingPageProps) {
    const ipc = useMainWindowIpc();
    const { androidId } = useContext(AndroidIdContext)
    const [deviceConfig, setDeviceConfig] = useState<{ [key: string]: string | number | boolean; }>({});
    const [applicationConfig, setApplicationConfig] = useState<{ [key: string]: string | number | boolean; }>({});
    const [boundDeviceId, setBoundDeviceId] = useState<string | null>(null);
    useEffect(() => {
        ipc.getDeviceAllConfig().then(res => {
            setDeviceConfig(res);
        });
        ipc.getAllConfig().then(res => {
            setBoundDeviceId(res.boundDeviceId as string);
            setApplicationConfig(res);
        });
    }, []);
    
    return (
        <div style={{ display: hidden ? "none" : "block" }} className="flex flex-col h-full overflow-y-scroll">
            <mdui-list>
                <mdui-list-subheader className="ml-5 h-10 font-bold">全局</mdui-list-subheader>
                <SettingItemCommon title="绑定/解绑设备" onClick={() => onBoundDeviceItemClick(androidId, boundDeviceId, setBoundDeviceId, deviceConfig, ipc)} desc={boundDeviceId ? `已绑定设备ID:${boundDeviceId}` : "未绑定"} icon="link" />
                <SettingItemSelect title="掉线轮询间隔" icon="monitor_heart" desc="降低设备掉线时反应时间 可能影响手机耗电量" items={heartbeatDelayOptions} configs={applicationConfig} setConfig={ipc.setConfig} configKey="heartBeatDelay" onChange={rebootSnackbar}/>
                <SettingItemSelect title="日志输出等级" desc="方便调试 可能对性能有微弱影响" icon="library_books" items={logLevelOptions} configs={applicationConfig} setConfig={ipc.setConfig} configKey="logLevel" onChange={rebootSnackbar}/>
                <mdui-list-subheader className="ml-5 h-10 font-bold">通知转发</mdui-list-subheader>
                <SettingItemSwitch title="启用通知转发" icon="fork_right" configs={deviceConfig} configKey="enableNotificationForward" setConfig={ipc.setDeviceConfig} />
                <SettingItemSwitch title="计算机锁屏后继续推送转发的通知" desc="开启后即使计算机锁屏也会弹出通知(一般用不上)" icon="close_fullscreen" configs={deviceConfig} configKey="pushNotificationOnLockedScreen" setConfig={ipc.setDeviceConfig} />
                <SettingItemSwitch title="全屏时推送通知" desc="全屏视频 游戏 PPT等" icon="fullscreen" configs={deviceConfig} configKey="pushNotificationOnFullScreen" setConfig={ipc.setDeviceConfig} />
                <SettingItemSwitch title="使用通知历史记录" icon="history" configs={deviceConfig} configKey="enableNotificationLog" setConfig={ipc.setDeviceConfig} />
                <SettingItemSelect title="默认通知展示方式" icon="notifications_active" items={notificationShowMethodOptions} configs={deviceConfig} configKey="defaultNotificationShowMode" setConfig={ipc.setDeviceConfig}/>
                <mdui-list-subheader className="ml-5 h-10 font-bold">隐私</mdui-list-subheader>
                <SettingItemSelect title="验证方式" icon="key" items={authMethodOptions} onChange={() => false} configKey="protectMethod" configs={deviceConfig} setConfig={ipc.setDeviceConfig}/>
                <SettingItemSwitch title="通知转发记录保护" icon="doorbell" configs={deviceConfig} configKey="protectNotificationForwardPage" setConfig={ipc.setDeviceConfig} />
                <SettingItemCommon title="更改密码" icon="link" onClick={()=>onChangePasswordItemClick(androidId,deviceConfig,ipc)} />
                <SettingItemSwitch title="截录屏保护" desc="阻止截图录屏获取软件内容保护隐私 适用于直播或屏幕共享等" icon="shield" configs={applicationConfig} configKey="enableContentProtection" setConfig={ipc.setConfig} />
                <mdui-list-subheader className="ml-5 h-10 font-bold">辅助功能</mdui-list-subheader>
                <SettingItemSwitch title="电池满电提醒" desc="手机电量充满时发出通知" icon="battery_4_bar" configs={deviceConfig} configKey="enableBatteryFullNotification" setConfig={ipc.setDeviceConfig} />
                <mdui-list-subheader className="ml-5 h-10 font-bold">杂项</mdui-list-subheader>
                <SettingItemCommon title="关于" icon="info" onClick={() => alert("TODO")} />
                <SettingItemCommon title="清除日志" icon="delete_sweep" onClick={()=>onDeleteLogsItemClick(ipc)} />
            </mdui-list>
        </div>
    )
}