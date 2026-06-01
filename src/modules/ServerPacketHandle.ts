import fs from "fs-extra";
import type { BrowserWindow } from "electron";
import { app } from "electron";
import path from "path";
import type ws from "ws";
import Util from "./Util";
import TransmitFileWriter from "./TransmitFileWriter";
import type NotificationCore from "./NotificationCore";
import type Server from "./Server";
export async function onTransmitPacket(jsonObj: any, appWindow: BrowserWindow, socket: ws) {
    logger.writeDebug(`Received a new transmit packet.Type:${jsonObj.messageType}`);
    //处理文件等
    switch (jsonObj.messageType) {
        case "planeText":
            appWindow.webContents.send("webviewEvent", "transmitAppendPlainText", jsonObj.data);
            break;
        case "file":
            const fileDirPath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`;
            await fs.ensureDir(fileDirPath);
            //检查是否有文件重名
            const dirFileList = await fs.readdir(fileDirPath);
            // 防止路径穿越
            jsonObj.name = path.basename(jsonObj.name);
            jsonObj.displayName = jsonObj.name;
            for (const dirFileName of dirFileList) {
                if (dirFileName === jsonObj.name) {
                    //有重名
                    if (global.config.deleteTransmitConflictFile) {
                        await fs.remove(fileDirPath + dirFileName);
                    } else {
                        //设置显示名称 尝试逃过浅拷贝
                        jsonObj.displayName = `${jsonObj.name}`;
                        //改为文件原名+时间戳+原后缀
                        //文件有后缀名
                        if (jsonObj.name.lastIndexOf(".") !== -1) {
                            jsonObj.name = jsonObj.name.slice(0, jsonObj.name.lastIndexOf(".")) + "_" + Date.now().toString() + jsonObj.name.slice(jsonObj.name.lastIndexOf("."), jsonObj.name.length);
                        } else {
                            //无后缀名
                            jsonObj.name = jsonObj.name + Date.now().toString();
                        }
                        logger.writeDebug(`Transmit file auto rename because file name repeat:"${jsonObj.displayName}"=>"${jsonObj.name}"`)
                        //检查文件名长度
                        if (jsonObj.name.length > 255) {
                            //直接改成时间戳文件名 不管打开了
                            jsonObj.name = Date.now().toString();
                            logger.writeInfo(`Transmit file name too long:"${jsonObj.displayName}"=>"${jsonObj.name}"`)
                        }
                    }
                    break
                }
            }
            //检查Windows系统文件名保留字
            if (Util.detectWindowsReservedWords(jsonObj.name)) {
                logger.writeWarn(`Transmit File name unavailable by Windows reserved words`)
                socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: "该文件名因操作系统限制不可使用" }));
                return
            }
            //文件大小检查 -1为无效
            if (jsonObj.size === -1) {
                logger.writeWarn("Receive file size error:-1");
                appWindow.webContents.send("webviewEvent", "showAlert", { title: "接收文件异常", content: "异常文件\n请检查文件是否存在或为特殊类型\n也可能是软件Bug" });
                socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: "异常文件\n请检查文件是否存在或为特殊类型\n也可能是软件Bug" }));
                return
            }
            try {
                const fileSocket = new TransmitFileWriter(jsonObj.name, `${fileDirPath}${jsonObj.name}`, jsonObj.size, appWindow, jsonObj.displayName, jsonObj.encryptKey, jsonObj.encryptIv);
                //等待初始化完成
                await fileSocket.init();
                logger.writeDebug("Transmit file init success");
                socket.send(JSON.stringify({ _responseId: jsonObj._requestId, port: fileSocket.port, _result: "SUCCESS" }));
            } catch (error: any) {
                logger.writeError(`Init transmit file socket failed:${error}`);
                socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: `内部异常:创建文件输出流失败\n${error.stack}` }));
                return
            }
            break
        default:
            logger.writeWarn(`Unknown transmit message type:${jsonObj.messageType}`);
            break;
    }
}
export async function onNotificationForwardPacket(jsonObj: any, notificationCore: NotificationCore | null) {
    //避免出现图标同步问题 无论是否开启通知 收到图标都要写入
    if (jsonObj.iconBase64 && jsonObj.iconHash) {
        logger.writeDebug(`Receive icon from notification:${jsonObj.iconHash}`);
        const iconCachePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/notificationIcons`;
        const iconFile = `${iconCachePath}/${jsonObj.iconHash}`;
        await fs.ensureDir(iconCachePath);
        if (!await fs.exists(iconFile)) {
            await fs.writeFile(`${iconCachePath}/${jsonObj.iconHash}`, Buffer.from(jsonObj.iconBase64, "base64"));
            logger.writeDebug(`Write icon to cache:${iconFile}`);
        }
    }
    if (!global.deviceConfig.enableNotification) return
    notificationCore?.onNewNotification(jsonObj.package, jsonObj.time, jsonObj.title, jsonObj.content, jsonObj.appName, jsonObj.key, jsonObj.progress, jsonObj.ongoing, jsonObj.isLockScreen, jsonObj.iconHash);
}
export async function onSyncIconPackPacket(jsonObj: any, socket: ws,server:Server) {
    logger.writeDebug("Request sync icon pack");
    const filePath = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/iconArchive`;
    const extractDir = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/iconCache/`;
    //检查摘要
    //要本地有文件同时安卓端发来hash
    //文本中存hash 包文件解压完就删
    if (await fs.pathExists(extractDir) && await fs.exists(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`)) {
        const hash: string = await fs.readFile(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`, { encoding: "utf-8" });
        logger.writeDebug(`Icon pack hash detail\nLocal:${hash}\nAndroid client:${jsonObj.hash}`)
        if (hash === jsonObj.hash) {
            //文件相同 无需更新
            logger.writeInfo(`Need not update icon pack with same hash:${hash}`);
            socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR", msg: "NEED_NOT" }));
            return
        }
    }
    logger.writeDebug("Starting download icon pack");
    const SocketFileWriter = (await import("./SocketFileWriter.js")).default.SocketFileWriter;
    const fileSocket = new SocketFileWriter(filePath, `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/`, null, jsonObj.key, jsonObj.iv);
    try {
        await fileSocket.init();
        //不放在这发送事件时窗口更替还没完成 会崩溃
        Util.execTaskWithAutoRetry(() => {
            try {
                if (!server.appWindow || server.appWindow.isDestroyed()) {
                    return false
                }
                server.appWindow.webContents.send("webviewEvent", "editState", { type: "add", id: "busy_waiting_icon_pack" });
                return true
            } catch (error) {
                return false;
            }
        }, 500, 5, "addIconPackReceivingState");
        fileSocket.setEventHandle({
            onError: (err) => {
                logger.writeWarn(`Failed to download application icons pack\n${err}`);
            },
            onSuccess: async (file: string) => {
                logger.writeInfo("Success download icons pack.Waiting verify and extract");
                //计算hash
                const packHash: string = await Util.getSHA256(file, true);
                logger.writeDebug(`Success download icon pack.Hash:${packHash}`);
                //解压
                const NodeStreamZip = (await import("node-stream-zip")).default
                const zipFile = new NodeStreamZip.async({ file: file });
                //创建目录
                //删除旧目录重新创建
                await fs.remove(extractDir);
                await fs.ensureDir(extractDir);
                await zipFile.extract(null, extractDir);
                await zipFile.close();
                //保存hash 放在解压成功之后
                //先删掉旧的
                await fs.remove(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`);
                await fs.writeFile(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/assets/appIcons.sha256`, packHash);
                //删除缓存
                await fs.remove(file);
                logger.writeInfo("Success download and extracted applications icon pack");
                //移除提醒
                Util.execTaskWithAutoRetry(() => {
                    try {
                        if (!server.appWindow || server.appWindow.isDestroyed()) {
                            return false
                        }
                        server.appWindow.webContents.send("webviewEvent", "editState", { type: "remove", id: "busy_waiting_icon_pack" });
                        server.appWindow.webContents.send("webviewEvent", "updatedIconPack");
                        return true
                    } catch (error) {
                        return false;
                    }
                }, 300, 5, "removeIconPackReceivingState")
            }
        })
        logger.writeDebug("File init success");
    } catch (error: any) {
        logger.writeError(`Init file socket failed:${error}`);
        socket.send(JSON.stringify({ _responseId: jsonObj._requestId, _result: "ERROR" }));
        return
    }
    socket.send(JSON.stringify({ _responseId: jsonObj._requestId, port: fileSocket.port, _result: "SUCCESS" }));
}