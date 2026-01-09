import { snackbar, confirm, prompt } from "mdui";
import { autoAuthorization, openPasswordInputDialog, type ProtectMethod } from "~/utils";
import cryptRandomString from "crypto-random-string";
import type useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc";
import { sha256 } from "js-sha256";
export async function onBoundDeviceItemClick(
    androidId: string,
    boundDeviceId: string | null,
    setBoundDeviceId: React.Dispatch<React.SetStateAction<string | null>>,
    deviceConfig: { [key: string]: string | number | boolean },
    ipc: ReturnType<typeof useMainWindowIpc>
) {
    snackbar({
        message: "此操作需要验证您是机主",
        autoCloseDelay: 3500
    });
    const authResult = await autoAuthorization(deviceConfig.protectMethod as ProtectMethod, ipc.startAuthorization, androidId);
    if (!authResult) {
        snackbar({
            message: "验证失败",
            autoCloseDelay: 1000
        });
        return
    }
    if (boundDeviceId) {
        const connectedBoundDevice = boundDeviceId === androidId;
        // 解绑
        confirm({
            headline: connectedBoundDevice ? "解绑当前设备?" : "更换绑定设备?",
            description: connectedBoundDevice ? "将不再自动连接到该设备" : "将不再与旧设备自动连接 改为连接当前设备",
            confirmText: "确定",
            cancelText: "取消",
            onConfirm: async () => {
                //写入配置
                if (connectedBoundDevice) {
                    await ipc.sendRequestPacket<void>({ packetType: "main_unbindDevice" });
                    ipc.setConfig("boundDeviceId", null);
                    ipc.setConfig("boundDeviceKey", null)
                    setBoundDeviceId(null);
                    console.info("Unbound device");
                } else {
                    const key = cryptRandomString({ length: 256 });
                    await ipc.sendRequestPacket<void>({ packetType: "main_bindDevice", msg: key });
                    ipc.setConfig("boundDeviceId", androidId);
                    ipc.setConfig("boundDeviceKey", key);
                    setBoundDeviceId(androidId);
                    console.info(`Rebound device:${androidId}`);
                }
                snackbar({
                    message: connectedBoundDevice ? "已解绑" : "已换绑",
                    autoCloseDelay: 2000
                });
            }
        }).catch(() => { });
    } else {
        // 无绑定设备
        confirm({
            headline: "绑定当前连接设备?",
            description: "绑定后将在软件打开时自动扫描该设备并连接",
            confirmText: "绑定",
            cancelText: "取消",
            onConfirm: async () => {
                //发送绑定请求
                const key = cryptRandomString({ length: 256 });
                await ipc.sendRequestPacket<void>({ packetType: "main_bindDevice", msg: key });
                ipc.setConfig("boundDeviceId", androidId);
                ipc.setConfig("boundDeviceKey", key);
                setBoundDeviceId(androidId);
                snackbar({
                    message: "绑定完成",
                    autoCloseDelay: 2000
                });
                console.info(`Bound device:${androidId}`);
            }
        })
    }
}
export async function onChangePasswordItemClick(
    androidId: string,
    deviceConfig: { [key: string]: string | number | boolean },
    ipc: ReturnType<typeof useMainWindowIpc>
) {
    const pwdHash = localStorage.getItem(`pwdHash_${androidId}`);
    console.debug("Request change password");
    if (pwdHash) {
        // 有密码 验证密码
        console.debug("Request verify password before change password");
        const verifyResult = await openPasswordInputDialog("验证密码", androidId)
        if (!verifyResult) {
            snackbar({
                message: "验证失败",
                autoCloseDelay: 1250
            });
            console.info("Verify password failed");
            return
        }
    } else {
        //无密码 检查oath是否开启
        if (deviceConfig.protectMethod === "oauth") {
            // oauth
            snackbar({
                message: "请先完成验证",
                autoCloseDelay: 1250
            });
            const authResult = await autoAuthorization(deviceConfig.protectMethod as ProtectMethod, ipc.startAuthorization, androidId);
            if (!authResult) {
                snackbar({
                    message: "验证失败",
                    autoCloseDelay: 1250
                });
                return
            }
            console.info("Oauth verify failed");
        }
        //啥都没有 直接放行
    }
    prompt({
        headline: "修改密码",
        description: "请输入新密码",
        confirmText: "确定",
        cancelText: "取消",
        textFieldOptions: {
            type: "password"
        },
        onConfirm: async (value) => {
            if (value.trim() === "") {
                snackbar({ message: "密码不能为空" });
                return
            }
            localStorage.setItem(`pwdHash_${androidId}`, sha256(value));
            snackbar({
                message: "修改成功",
                autoCloseDelay: 1250
            });
            console.info("Change password success");
        }
    }).catch(() => { });
}
export function onDeleteLogsItemClick(
    ipc: ReturnType<typeof useMainWindowIpc>
) {
    confirm({
        headline: "清除日志确认",
        description: "确认清除日志?\n(通常不会造成影响)",
        confirmText: "确认",
        cancelText: "取消",
        onConfirm: async () => {
            await ipc.deleteLogs();
            snackbar({
                message: "日志清除完成",
                autoCloseDelay: 1750
            });
            console.info("Cleaned all logs");
        },
    }).catch(() => { });
}
export function rebootSnackbar() {
    snackbar({
        message: "重启程序后生效",
        autoCloseDelay: 2500
    })
}
export async function onProtectMethodChange(targetValue: ProtectMethod, ipc: ReturnType<typeof useMainWindowIpc>, androidId: string): Promise<boolean> {
    const currentProtectMethod = await ipc.getDeviceConfig("protectMethod", "none") as ProtectMethod;
    const verifyResult = await autoAuthorization(currentProtectMethod, ipc.startAuthorization, androidId, "更改此设置前需要验证");
    if (!verifyResult) {
        snackbar({
            message: "验证失败",
            autoCloseDelay: 1250
        });
        console.info("Change protect method verify failed");
        return false;
    }
    if (targetValue === "oauth") {
        // 无凭证则创建
        if (!await ipc.getConfig("hasOAuthCredentials", false)) {
            snackbar({
                message: `请在弹出的Windows Hello窗口中确认以初始化凭证`,
                autoCloseDelay: 4500
            });
            if (!await ipc.createCredentials()) {
                snackbar({
                    message: "凭证初始化失败",
                    autoCloseDelay: 1500
                });
                console.warn("Failed to init credentials");
                return false;
            };
            await ipc.setConfig("hasOAuthCredentials", true);
            snackbar({
                message: `初始化成功`,
                autoCloseDelay: 1500
            });
            console.info("Success init credentials");
        }
        await ipc.setDeviceConfig("protectMethod", targetValue);
        console.info(`Change protect method to ${targetValue}`);
        return true
    } else if (targetValue === "password") {
        const pwdHash = localStorage.getItem(`pwdHash_${androidId}`);
        // 无密码则创建
        if (!pwdHash) {
            try {
                const inputPassword = await prompt({
                    headline: "创建密码",
                    description: "设置一个密码",
                    confirmText: "确定",
                    cancelText: "取消",
                    textFieldOptions: {
                        type: "password"
                    }
                });
                if (inputPassword.trim() === "") {
                    snackbar({ message: "密码不能为空" });
                    return false
                }
                localStorage.setItem(`pwdHash_${androidId}`, sha256(inputPassword));
                console.info("Set password success");
            } catch (error) {
                snackbar({
                    message: "设置失败",
                    autoCloseDelay: 1250
                });
                console.error(`Set password error:${error}`);
                return false
            }
        }
        await ipc.setDeviceConfig("protectMethod", targetValue);
        return true
    } else {
        await ipc.setDeviceConfig("protectMethod", targetValue);
        return true;
    }
}