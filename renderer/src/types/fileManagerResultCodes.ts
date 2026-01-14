export const FileManagerResultCode = {
    /**
     * 正常
     */
    CODE_NORMAL: 0,
    /**
     *调用读取文件夹但目标不是文件夹
     */
    CODE_NOT_DIR: 1,
    /**
     *读取无权限
     */
    CODE_NOT_PERMISSION: 2,
    /**
     *功能被关闭
     */
    CODE_FUNCTION_DISABLED: 3,
    /**
     *设备不受信任
     */
    CODE_DEVICE_NOT_TRUSTED: 4
} as const;
export function isDotPopPathResultCode(code:number){
    return code===FileManagerResultCode.CODE_NOT_PERMISSION||code===FileManagerResultCode.CODE_DEVICE_NOT_TRUSTED||code===FileManagerResultCode.CODE_FUNCTION_DISABLED
}
export const FileManagerResultCodeMessage={
    [FileManagerResultCode.CODE_NORMAL]:"正常",
    [FileManagerResultCode.CODE_NOT_DIR]:"无法打开该目录",
    [FileManagerResultCode.CODE_NOT_PERMISSION]:"软件无权访问该目录",
    [FileManagerResultCode.CODE_FUNCTION_DISABLED]:"文件浏览功能被关闭\n请在手机端打开后重试",
    [FileManagerResultCode.CODE_DEVICE_NOT_TRUSTED]:"设备不受信任\n请在手机端信任此计算机后重试"
}