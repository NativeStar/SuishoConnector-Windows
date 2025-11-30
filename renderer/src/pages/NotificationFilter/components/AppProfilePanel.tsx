import "mdui/components/collapse";
import "mdui/components/collapse-item";
import "mdui/components/text-field"
import "mdui/components/icon"
import "mdui/components/avatar"
import { useEffect, useState } from "react";
import useNotificationFilterWindowIpc from "~/hooks/ipc/useNotificationFilterWindowIpc";
import type { ApplicationListData } from "~/types/ipc";
function CollapseListItem() {
    return (
        <mdui-collapse>
            <mdui-collapse-item>
                <mdui-list-item slot="header" icon="apps">
                    过滤选项
                    <mdui-icon slot="end-icon" name="keyboard_arrow_down" />
                </mdui-list-item>
                <div>
                    <mdui-text-field className="w-11/12 ml-2" variant="outlined" label="输入应用名并回车" clearable></mdui-text-field>
                    <mdui-list-item id="forceRefreshAppListItem" slot="header" icon="refresh">
                        刷新列表
                    </mdui-list-item>
                </div>
            </mdui-collapse-item>
        </mdui-collapse>
    )
}
export default function AppProfilePanel() {
    const ipc = useNotificationFilterWindowIpc();
    const [dataPath, setDataPath] = useState<string | null>(null);
    const [packageList, setPackageList] = useState<ApplicationListData[] | null>([]);
    useEffect(() => {
        ipc.getPackageList(false).then(value => {
            setPackageList(value.data);
        })
    }, []);
    ipc.getDeviceDataPath().then(value => setDataPath(value));
    return (
        <mdui-tab-panel slot="panel" value="appProfile" className="flex">
            <div className="w-[33%] flex flex-col overflow-y-auto h-[calc(100vh-5.3rem)]">
                <CollapseListItem />
                {
                    packageList?.map((pkgInfo) => (
                        <mdui-list-item headline={pkgInfo.appName} className="wrap-break-word" end-icon="arrow_right">
                            <mdui-avatar slot="icon" src={`${dataPath}assets/iconCache/${pkgInfo.packageName}`} />
                        </mdui-list-item>
                    ))
                }
            </div>
            <div>
                {packageList?.length === 0 &&
                    <div className="ml-36 mt-12 text-[gray]">
                        <span>需要在手机端授予本程序获取应用列表权限</span>
                        <br />
                        <span className="ml-0.5">并选择"始终允许"而不是"仅在使用中允许"</span>
                    </div>
                }

            </div>
        </mdui-tab-panel>
    )
}