enum ConnectionCloseCode {
    //手机端手动关闭
    CloseFromClient=1000,
    //pc端手动关闭
    CloseFromServer=1001,
    //手机端异常关闭
    CloseFromClientError=1002,
    //手机端wifi断开
    CloseFromClientWifiDisconnect=1003,
    //心跳超时
    CloseHeartBeatTimeout=1006,
    //手机端崩溃
    CloseFromClientCrash=1007,
    // 已有连接
    CONNECTION_ALREADY_EXISTS=1008
}
export default ConnectionCloseCode;