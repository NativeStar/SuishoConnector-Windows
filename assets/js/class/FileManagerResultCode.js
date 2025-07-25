class FileManagerResultCode {
    /**
     * 正常
     * @static
     * @memberof FileManagerResultCode
     */
    static CODE_NORMAL=0;
    /**
     *调用读取文件夹但目标不是文件夹
     * @static
     * @memberof FileManagerResultCode
     */
    static CODE_NOT_DIR=1;
    /**
     *读取无权限
     * @static
     * @memberof FileManagerResultCode
     */
    static CODE_NOT_PERMISSION=2;
    /**
     *功能被关闭
     * @static
     * @memberof FileManagerResultCode
     */
    static CODE_FUNCTION_DISABLED=3;
    /**
     *设备不受信任
     * @static
     * @memberof FileManagerResultCode
     */
    static CODE_DEVICE_NOT_TRUSTED=4;
}
export default FileManagerResultCode;