import "mdui/components/list-subheader"
import SettingItemCommon from "./components/SettingItemCommon"
import SettingItemSelect from "./components/SettingItemSelect"
import { authMethodOptions, heartbeatDelayOptions, logLevelOptions, notificationShowMethodOptions } from "./optionsList"
import SettingItemSwitch from "./components/SettingItemSwitch"
interface SettingPageProps {
    hidden: boolean
}
export default function SettingPage({ hidden }: SettingPageProps) {
    // TODO 重做一个Select组件 自带的太垃圾了
    return (
        <div style={{ display: hidden ? "none" : "block" }} className="flex flex-col h-full overflow-y-scroll">
            <mdui-list>
                <mdui-list-subheader className="ml-5 h-10 font-bold">全局</mdui-list-subheader>
                <SettingItemCommon title="绑定/解绑设备" desc="未绑定" icon="link" />
                <SettingItemSelect title="掉线轮询间隔" icon="monitor_heart" desc="降低设备掉线时反应时间 可能影响手机耗电量" items={heartbeatDelayOptions} value="MEDIUM" onChange={() => { }} />
                <SettingItemSelect title="日志输出等级" desc="方便调试 可能对性能有微弱影响" icon="library_books" items={logLevelOptions} value="NONE" onChange={() => { }} />
                <mdui-list-subheader className="ml-5 h-10 font-bold">通知转发</mdui-list-subheader>
                <SettingItemSwitch title="启用通知转发" icon="fork_right" onChange={() => { }} value={true} />
                <SettingItemSwitch title="计算机锁屏后继续推送转发的通知" desc="开启后即使计算机锁屏也会弹出通知(一般用不上)" icon="close_fullscreen" onChange={() => { }} value={true} />
                <SettingItemSwitch title="全屏时推送通知" desc="全屏视频 游戏 PPT等" icon="fullscreen" onChange={() => { }} value={true} />
                <SettingItemSwitch title="使用通知历史记录" icon="history" onChange={() => { }} value={true} />
                <SettingItemSelect title="默认通知展示方式" icon="notifications_active" items={notificationShowMethodOptions} value="none" onChange={() => { }} />
                <mdui-list-subheader className="ml-5 h-10 font-bold">隐私</mdui-list-subheader>
                <SettingItemSelect title="验证方式" icon="key" items={authMethodOptions} value="none" onChange={() => { }} />
                <SettingItemSwitch title="通知转发记录保护" icon="doorbell" onChange={() => { }} value={true} />
                <SettingItemCommon title="更改密码" icon="link" />
                <SettingItemSwitch title="截录屏保护" desc="阻止截图录屏获取软件内容保护隐私 适用于直播或屏幕共享等" icon="shield" onChange={() => { }} value={true} />
                <mdui-list-subheader className="ml-5 h-10 font-bold">辅助功能</mdui-list-subheader>
                <SettingItemSwitch title="电池满电提醒" desc="手机电量充满时发出通知" icon="battery_4_bar" onChange={() => false} value={true} />
                <mdui-list-subheader className="ml-5 h-10 font-bold">杂项</mdui-list-subheader>
                <SettingItemCommon title="关于" icon="info" />
                <SettingItemCommon title="清除日志" icon="delete_sweep" />
            </mdui-list>
        </div>
    )
}