import "mdui/components/collapse";
import "mdui/components/collapse-item";
import "mdui/components/text-field"
import "mdui/components/icon"
import "mdui/components/avatar"
import "mdui/components/divider"
import "mdui/components/select"
import "mdui/components/menu-item"
import { useEffect, useState } from "react";
import useNotificationFilterWindowIpc from "~/hooks/ipc/useNotificationFilterWindowIpc";
import type { ApplicationListData, ApplicationNotificationProfile } from "~/types/ipc";
interface CollapseListItemProp {
    setSearchText: React.Dispatch<React.SetStateAction<string>>;
    searchText: string,
    setPackageList: React.Dispatch<React.SetStateAction<ApplicationListData[] | null>>,
    setCurrentAppPackageName: React.Dispatch<React.SetStateAction<string>>,
}
interface ProfileSettingPanelProps {
    packageName: string,
    packageList: ApplicationListData[] | null,
    dataPath: string | null,
    appName: string
}
interface SettingListItemWithSwitchProps {
    title: string,
    desc?: string,
    icon: string,
    profile: ApplicationNotificationProfile | null,
    profileKey: keyof ApplicationNotificationProfile,
    onProfileEdit: (profileKey: keyof ApplicationNotificationProfile, value: boolean | ApplicationNotificationProfile["detailShowMode"]) => void
}
interface AppProfilePanelProps {
    packageName: string | null,
    appName: string | null,

}
function SettingListItemWithSwitch({ icon, title, desc, profileKey, profile, onProfileEdit }: SettingListItemWithSwitchProps) {
    // 开关设置项 点击列表本身可改变开关
    return (
        <mdui-list-item onClick={() => {
            onProfileEdit(profileKey, !profile ? true : !profile[profileKey]);
        }} icon={icon} headline={title} description={desc}>
            <mdui-switch onClick={(event) => {
                event.preventDefault()
                event.stopPropagation();
                onProfileEdit(profileKey, !profile ? true : !profile[profileKey]);
            }} checked={profile ? profile[profileKey] as boolean : false} slot="end-icon" className="w-full" checked-icon="" />
        </mdui-list-item>
    )
}
function CollapseListItem({ searchText, setSearchText, setPackageList, setCurrentAppPackageName }: CollapseListItemProp) {
    const ipc = useNotificationFilterWindowIpc();
    return (
        <mdui-collapse>
            <mdui-collapse-item>
                <mdui-list-item slot="header" icon="apps">
                    过滤选项
                    <mdui-icon slot="end-icon" name="keyboard_arrow_down" />
                </mdui-list-item>
                <div>
                    <mdui-text-field className="w-11/12 ml-2" value={searchText} onChange={event => setSearchText((event.target as HTMLInputElement).value)} variant="outlined" label="输入应用名并回车" clearable></mdui-text-field>
                    <mdui-list-item slot="header" icon="refresh" onClick={() => {
                        setCurrentAppPackageName("");
                        setPackageList(null);
                        ipc.getPackageList(true).then(value => {
                            setPackageList(value.data);
                        });
                    }}>
                        刷新列表
                    </mdui-list-item>
                </div>
            </mdui-collapse-item>
        </mdui-collapse>
    )
}
function ProfileSettingPanel({ packageName, packageList, dataPath, appName }: ProfileSettingPanelProps) {
    const ipc = useNotificationFilterWindowIpc();
    const [profile, setProfile] = useState<ApplicationNotificationProfile | null>(null);
    useEffect(() => {
        ipc.getNotificationProfile(packageName).then(profile => {
            setProfile(profile);
        })
    }, [packageName]);
    function onProfileEdit(profileKey: keyof ApplicationNotificationProfile, value: boolean | ApplicationNotificationProfile["detailShowMode"]) {
        const newProfile = { ...profile!, [profileKey]: value };
        setProfile(newProfile);
        ipc.setNotificationProfile(packageName, newProfile);
    };
    return (
        packageList === null ?
            <span className="text-[gray] ml-46 mt-20">
                正在加载应用列表
            </span> :
            packageName === "" ?
                <span className="text-[gray] ml-46 mt-20">
                    选择应用以进行单独配置
                </span> :
                <div className="flex flex-col h-full w-full">
                    {/* 应用信息顶栏 */}
                    <div className="flex mt-2 ml-3">
                        <mdui-avatar src={`${dataPath}assets/iconCache/${packageName}`} className="mduiAvatarBorder" onDragStart={event => event.preventDefault()} />
                        <span className="mt-1.5 ml-1">{appName}</span>
                    </div>
                    <mdui-divider className="mt-2 w-full" />
                    {/* 基础设置项 */}
                    <SettingListItemWithSwitch title="启用通知转发" icon="alt_route" profile={profile} profileKey="enableNotification" onProfileEdit={onProfileEdit} />
                    <SettingListItemWithSwitch title="使用单独配置" icon="fork_right" profileKey="enableProfile" profile={profile} onProfileEdit={onProfileEdit} />
                    <mdui-divider className="w-full" />
                    {profile?.enableProfile && profile?.enableNotification ?
                        <>
                            <SettingListItemWithSwitch title="进行内容过滤" desc="关闭后将不再对其通知内容使用全局关键词过滤" icon="filter_vintage" profile={profile} profileKey="enableTextFilter" onProfileEdit={onProfileEdit} />
                            <SettingListItemWithSwitch title="深层隐藏" desc="来自该应用的通知需右键点击解锁图标并验证通过后才显示 需开启通知转发记录保护才能生效" icon="private_connectivity" profile={profile} profileKey="enableDeepHidden" onProfileEdit={onProfileEdit} />
                            <SettingListItemWithSwitch title="不保存至推送记录" desc="来自该应用的通知将不会存储至通知历史记录中" icon="history_toggle_off" profile={profile} profileKey="disableRecord" onProfileEdit={onProfileEdit} />
                            {/* 推送模式选择 */}
                            <mdui-select value={profile.detailShowMode} onChange={(event) => {
                                const value = (event.target as HTMLSelectElement).value as ApplicationNotificationProfile["detailShowMode"] | "";
                                if (value === "") {
                                    event.preventDefault();
                                    (event.target as HTMLSelectElement).value = profile.detailShowMode;
                                    return
                                }
                                onProfileEdit("detailShowMode", value);
                            }} className="w-[98%] ml-1" label="通知展示模式" icon="adjust" variant="outlined" onDragStart={e => e.preventDefault()}>
                                <mdui-menu-item value="all">全部显示</mdui-menu-item>
                                <mdui-menu-item value="nameOnly">仅应用名</mdui-menu-item>
                                <mdui-menu-item value="hide" end-text="不会显示通知标题内容等信息">全部隐藏</mdui-menu-item>
                                <mdui-menu-item value="none" end-text="内容仍会记录在历史通知中">不推送</mdui-menu-item>
                            </mdui-select>
                        </>
                        :
                        <span>
                            {profile?.enableNotification ?
                                <div className="text-center text-[gray]">
                                    已关闭单独配置
                                    <br />
                                    对其通知的处理方式将遵循全局配置
                                </div>
                                :
                                <div className="text-center text-[gray]">
                                    已禁用对该应用通知的处理
                                    <br />
                                    来自其的通知将不会被记录及转发
                                </div>
                            }
                        </span>

                    }
                </div>
    )
}
export default function AppProfilePanel({ packageName, appName }: AppProfilePanelProps) {
    const ipc = useNotificationFilterWindowIpc();
    const [dataPath, setDataPath] = useState<string | null>(null);
    const [packageList, setPackageList] = useState<ApplicationListData[] | null>(null);
    const [currentAppPackageName, setCurrentAppPackageName] = useState<string>("");
    const [currentAppName, setCurrentAppName] = useState<string>("");
    const [searchText, setSearchText] = useState<string>("");
    useEffect(() => {
        ipc.getPackageList(false).then(value => {
            setPackageList(value.data);
        });
    }, []);
    useEffect(() => {
        if (packageName && appName) {
            setCurrentAppName(appName);
            setCurrentAppPackageName(packageName);
        }
    }, [packageName, appName]);
    ipc.getDeviceDataPath().then(value => setDataPath(value));
    return (
        <mdui-tab-panel slot="panel" value="appProfile" className="flex">
            {/* 应用列表 */}
            <div className="w-[33%] flex flex-col overflow-y-auto h-[calc(100vh-5.3rem)]">
                <CollapseListItem searchText={searchText} setSearchText={setSearchText} setPackageList={setPackageList} setCurrentAppPackageName={setCurrentAppPackageName} />
                {
                    // 搜索强制不区分大小写
                    packageList?.filter((value) => value.appName.toLowerCase().includes(searchText.toLowerCase())).map((pkgInfo) => (
                        <mdui-list-item key={pkgInfo.packageName} headline={pkgInfo.appName} className="wrap-break-word" end-icon="arrow_right" onClick={() => {
                            setCurrentAppPackageName(pkgInfo.packageName)
                            setCurrentAppName(pkgInfo.appName)
                        }}>
                            <mdui-avatar slot="icon" src={`${dataPath}assets/iconCache/${pkgInfo.packageName}`} />
                        </mdui-list-item>
                    ))
                }
            </div>
            {/* 配置面板 */}
            <div className="flex-1 min-w-0">
                {packageList?.length === 0 ?
                    <div className="ml-36 mt-12 text-[gray]">
                        <span>需要在手机端授予本程序获取应用列表权限</span>
                        <br />
                        <span className="ml-0.5">并选择"始终允许"而不是"仅在使用中允许"</span>
                    </div>
                    :
                    <ProfileSettingPanel packageName={currentAppPackageName} packageList={packageList} dataPath={dataPath} appName={currentAppName} />
                }
            </div>
        </mdui-tab-panel>
    )
}