export default interface INotificationProfile{
    /**
     * @description 是否启用单独配置
     */
    enableProfile:boolean,
    /**
     * @description 是否接受通知 最高优先级
     */
    enableNotification:boolean,
    /**
     * @description 通知推送时的显示样式
     */
    detailShowMode:"all"|"nameOnly"|"hide"|"none",
    /**
     * @description 是否走全局文本过滤器
     */
    enableTextFilter:boolean,
    /**
     * @description 是否启用深层隐藏
     */
    enableDeepHidden:boolean,
    /**
     * @description 关闭对该应用通知的历史记录
     */
    disableRecord:boolean
}