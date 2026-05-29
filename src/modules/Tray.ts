///<reference path="../globalDeclare.d.ts" />
import type { Tray as TrayType, BrowserWindow as BrowserWindowType } from "electron";
import type PhoneServer from "./Server"
let trayInstance: TrayType | null = null;

export async function init(mainWindow: BrowserWindowType, connectedDevice: PhoneServer) {
    const { nativeImage, app, Tray, shell, Menu, BrowserWindow } = await import("electron");
    const fs = (await import("fs-extra")).default
    const path = await import("path");
    const Util = (await import("../modules/Util.js")).default.default;
    //创建托盘图标
    const trayImage: Electron.NativeImage = nativeImage.createFromPath(path.join(app.getAppPath(), "res", "icon.ico"));
    trayInstance = new Tray(trayImage);
    trayInstance.setTitle("Suisho Connector");
    trayInstance.setToolTip("Suisho Connector");
    trayInstance.addListener("double-click", () => {
        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            logger.writeDebug("Show main window by tray double click");
            mainWindow.show();
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    })
    const trayMenu: Electron.MenuItemConstructorOptions[] = [
        {
            label: "打开互传文件夹", click: () => {
                const dir = `${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`;
                //防止首次连接还没有目录时打开报错
                if (!fs.existsSync(dir)) {
                    fs.ensureDirSync(dir);
                }
                shell.openPath(`${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`.replaceAll("/", "\\"));
                logger.writeInfo(`Open folder in exploder(tray):${app.getPath("userData")}/programData/devices_data/${global.clientMetadata.androidId}/transmit_files/`)
            }
        },
        {
            type: "separator"
        },
        {
            label: "重启应用",
            click: () => {
                if (connectedDevice.isClosed) {
                    mainWindow?.destroy();
                    app.relaunch()
                    app.quit();
                    return
                }
                mainWindow?.webContents.send("webviewEvent", "rebootConfirm");
                if (mainWindow?.isMinimized()) {
                    logger.writeDebug("Restore main window from reboot confirm")
                    mainWindow.restore()
                } else {
                    logger.writeDebug("Show main window from reboot confirm")
                    mainWindow?.show();
                }
            }
        },
        {
            label: "退出",
            click: () => {
                if (connectedDevice.isClosed) {
                    mainWindow?.destroy()
                    app.quit();
                    return
                }
                mainWindow?.webContents.send("webviewEvent", "closeConfirm");
                if (mainWindow?.isMinimized()) {
                    logger.writeDebug("Restore main window from close confirm")
                    mainWindow.restore()
                } else {
                    logger.writeDebug("Show main window from close confirm")
                    mainWindow?.show();
                }
            }
        }
    ];
    if (Util.isDeveloping) {
        trayMenu.push({
            label: "调试功能",
            submenu: [
                {
                    label: "打开调试工具",
                    click: () => {
                        const allWindows: BrowserWindowType[] = BrowserWindow.getAllWindows();
                        allWindows[0].webContents.openDevTools();
                    }
                }
            ]
        },)
    }
    trayInstance.setContextMenu(Menu.buildFromTemplate(trayMenu));
}
export function getTrayInstance(){
    return trayInstance;
}