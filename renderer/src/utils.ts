import { sha256 } from "js-sha256"
import { prompt } from "mdui";
import type { NotificationItem } from "./types/database";

const urlRegexp = /^(?:https?:\/\/)?(?:(?:[\p{L}\p{N}-]+\.)+[A-Za-z\u00a1-\uffff]{2,}|(?:\d{1,3}\.){3}\d{1,3})(?::\d{2,5})?(?:[/?#][^\s]*)?$/iu;
const deepHideNotificationCacheMap = new Map<string, boolean>();
export function parseFileSize(size: number): string {
    if (size < 1024) {
        return `${size} B`
    }
    const sizeKB = size / 1024;
    if (sizeKB < 1024) {
        return `${sizeKB.toFixed(2)} KB`
    }
    const sizeMB = sizeKB / 1024;
    if (sizeMB < 1024) {
        return `${sizeMB.toFixed(2)} MB`
    }
    const sizeGB = sizeMB / 1024;
    if (sizeGB < 1024) {
        return `${sizeGB.toFixed(2)} GB`
    }
    return `${(sizeGB / 1024).toFixed(2)} TB`
}
export function checkUrl(text: string): boolean {
    if (!/^[a-z][\w.+-]*:\/\//i.test(text) && !/[/?#]/.test(text)) {
        return false;
    }
    return urlRegexp.test(text);
}
export function openPasswordInputDialog(desc: string, androidId: string) {
    return new Promise<boolean>((resolve) => {
        prompt({
            headline: "输入密码",
            description: desc,
            confirmText: "确定",
            cancelText: "取消",
            textFieldOptions: {
                type: "password"
            },
            onConfirm: (value) => {
                const input = value.toString();
                //空输入
                if (input.replaceAll(" ", "") === "") {
                    resolve(false);
                    return
                }
                const targetHash = localStorage.getItem(`pwdHash_${androidId}`);
                resolve(sha256(input) === targetHash);
            },
            onCancel: () => {
                resolve(false);
            }
            //库本身有bug
        }).catch(() => { });
    });
}
export async function initHideNotificationCache(getProfile: typeof window.electronMainProcess.getNotificationProfile, list: NotificationItem[]) {
    const cachedPackageName = new Set<string>();
    for (const item of list) {
        if (cachedPackageName.has(item.packageName)) {
            continue
        }
        const profile = await getProfile(item.packageName)
        deepHideNotificationCacheMap.set(item.packageName, profile.enableDeepHidden);
        cachedPackageName.add(item.packageName);
    }
}
export function needHideNotification(pkgName: string): boolean {
    return deepHideNotificationCacheMap.get(pkgName) ?? false;
}