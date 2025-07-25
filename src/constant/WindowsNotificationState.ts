//https://github.com/felixrieseberg/electron-notification-state/tree/master
class WindowsNotificationState {
    //屏保
    static QUNS_NOT_PRESENT = 1;
    //全屏模式
    static QUNS_BUSY = 2;
    //D3D全屏(游戏)
    static QUNS_RUNNING_D3D_FULL_SCREEN = 3;
    //演示模式 不管
    static QUNS_PRESENTATION_MODE = 4;
    //正常
    static QUNS_ACCEPTS_NOTIFICATIONS = 5;
    //win7的东西 不管
    static QUNS_QUIET_TIME = 6;
    /**
     * @description 状态是否可以发送通知
     * @static
     * @param {number} stateCode 状态码
     * @return {boolean} 当前状态通知是否可显示 
     * @memberof WindowsNotificationState
     */
    static sendable(stateCode:number):boolean{
        return stateCode===this.QUNS_BUSY||stateCode===this.QUNS_RUNNING_D3D_FULL_SCREEN||stateCode===this.QUNS_ACCEPTS_NOTIFICATIONS;
    }
    static isFullscreen(stateCode:number):boolean{
        //windows应用商店的软件可能无效
        return stateCode===this.QUNS_RUNNING_D3D_FULL_SCREEN||stateCode===this.QUNS_BUSY;
    }
    static isLockedScreen(stateCode:number){
        return stateCode===this.QUNS_NOT_PRESENT;
    }
}
// module.exports = WindowsNotificationState;
export default WindowsNotificationState