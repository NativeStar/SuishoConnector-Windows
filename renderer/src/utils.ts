import { sha256 } from "js-sha256"
import { prompt } from "mdui";
import type { NotificationItem } from "./types/database";

const urlRegexp = /^(?:https?:\/\/)?(?:(?:[\p{L}\p{N}-]+\.)+[A-Za-z\u00a1-\uffff]{2,}|(?:\d{1,3}\.){3}\d{1,3})(?::\d{2,5})?(?:[/?#][^\s]*)?$/iu;
const deepHideNotificationCacheMap = new Map<string, boolean>();
export type ProtectMethod = "oauth" | "password" | "none";
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
/**
 * 根据设置进行验证
 */
export async function autoAuthorization(type:ProtectMethod,startAuthorization:typeof window.electronMainProcess.startAuthorization,androidId:string,passwordDialogTitle?:string) { 
    switch (type) {
        case "none":
            return true;
        case "oauth":
            return await startAuthorization();
        case "password":
            return await openPasswordInputDialog(passwordDialogTitle??"请输入密码", androidId);
    }
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
export function updateDeepHideNotificationCache(pkgName: string, value: boolean) {
    deepHideNotificationCacheMap.set(pkgName, value);
}
export function needHideNotification(pkgName: string): boolean {
    return deepHideNotificationCacheMap.get(pkgName) ?? false;
}

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

let ffmpegInstance: FFmpegInstance | null = null;
let ffmpegLoadPromise: Promise<FFmpegInstance> | null = null;

function toRuntimeUrl(url: string) {
    if (/^(https?:|file:|data:|blob:)/.test(url)) {
        return url;
    }
    if (url.startsWith("/")) {
        if (window.location.protocol === "file:") {
            return url.slice(1);
        }
        return `${window.location.origin}${url}`;
    }
    return url;
}

export async function ensureFfmpegLoaded(): Promise<FFmpegInstance> {
    if (!ffmpegLoadPromise) {
        ffmpegLoadPromise = (async () => {
            const [{ FFmpeg }, { default: ffmpegWorkerUrl }, { default: ffmpegCoreUrl }, { default: ffmpegWasmUrl }] = await Promise.all([
                import("@ffmpeg/ffmpeg"),
                import("~/workers/ffmpegWorker.ts?worker&url"),
                import("@ffmpeg/core?url"),
                import("@ffmpeg/core/wasm?url"),
            ]);

            if (!ffmpegInstance) {
                ffmpegInstance = new FFmpeg();
            }
            if (!ffmpegInstance.loaded) {
                await ffmpegInstance.load({
                    classWorkerURL: toRuntimeUrl(ffmpegWorkerUrl),
                    coreURL: toRuntimeUrl(ffmpegCoreUrl),
                    wasmURL: toRuntimeUrl(ffmpegWasmUrl),
                });
            }
            return ffmpegInstance;
        })().catch((e) => {
            ffmpegLoadPromise = null;
            throw e;
        });
    }
    return ffmpegLoadPromise;
}
export async function releaseFfmpeg() {
    if (ffmpegInstance&&ffmpegInstance.loaded) {
        ffmpegInstance.terminate();
        ffmpegInstance = null;
        ffmpegLoadPromise = null;
    }
}
export function time2str(time:number) {
    const second=Math.floor(time);
    return `${Math.floor(second / 60)}:${second % 60 < 10 ? "0" + second % 60 : second % 60}`;
}