export default interface IDeviceConfig{
    /**
     * 通知转发历史记录保护
     */
    protectNotificationForwardPage:boolean,
    /**
     * 验证方式 WebOauth和传统密码(弹个框那种)
     */
    protectMethod:"oauth"|"password"|"none",
    /**
     * 密码验证时的hash
     */
    // protectNotificationForwardPagePasswordHash:null|string,
    /**
     * 是否启用通知转发
     */
    enableNotificationForward:boolean,
    /**
     * 锁屏时推送通知
     */
    pushNotificationOnLockedScreen:boolean,
    /**
     * 全屏时推送通知
     */
    pushNotificationOnFullScreen:boolean,
    /**
     * 默认通知展示模式
     */
    defaultNotificationShowMode:"all"|"nameOnly"|"hide"|"none"
}