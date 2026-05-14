import fs from "fs-extra";
import type crypto from "crypto";
import { app, type BrowserWindow, type MessageBoxOptions } from "electron";
import path from "path";
import build from "../constant/build.prop.json";
import configTemp from "../constant/configTemplate";
import type os from "os";
type Config = typeof configTemp;
type NetworkInfo = {
    name: string | null;
    address: string | null;
}
class Util {
    //Windows文件名保留字
    private static windowsReservedWords = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
    //url判断正则
    private static urlRegexp = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\*\+,;=.]+$/;
    private static LOG_TAG = "Util";
    static delay(ms = 0) {
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }
    static async getIPAddress(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): Promise<NetworkInfo> {
        const lastConnectionAddress: string = global.config["internal:lastConnectionAddress"]
        const lastConnectionName: string = global.config["internal:lastConnectionName"]
        const { getSelfAddressWithLegacy, getSelfAddressWithPowerShell } = await import("./GetSelfAddress.js");
        if (lastConnectionAddress && lastConnectionName) {
            const legacyGetAddressResult = await getSelfAddressWithLegacy(interfaces);
            //缓存和快速获取的数据一致 直接使用
            if (legacyGetAddressResult && legacyGetAddressResult.address === lastConnectionAddress && legacyGetAddressResult.name === lastConnectionName) {
                logger.writeInfo("Using last connection address", this.LOG_TAG);
                return {
                    address: lastConnectionAddress,
                    name: lastConnectionName
                }
            }
        }
        logger.writeInfo("Using PowerShell to get self address", this.LOG_TAG);
        return await getSelfAddressWithPowerShell()
    }
    /**
     * 
     * @param name 文件名
     * @returns 是否含有保留字
     */
    static detectWindowsReservedWords(name: string): boolean {
        const filteredName = name.replaceAll(" ", "");
        return this.windowsReservedWords.has(filteredName);
    }
    /**
     * @description 是否处于开发模式
     */
    static get isDeveloping(): boolean {
        return !app.isPackaged
    }
    /**
     * @static
     */
    static async loadConfig(): Promise<typeof config> {
        const { v4 } = await import("uuid");
        //文件路径
        const configFile = `${app.getPath("userData")}/programData/appCfg.json`;
        if (await fs.exists(configFile)) {
            //存在
            logger.writeInfo("Config file loaded", this.LOG_TAG);
            try {
                return await fs.readJSON(configFile, { encoding: "utf-8" });
            } catch (error) {
                logger.writeError(`Load config file error:${error}`, this.LOG_TAG);
                const { dialog } = await import("electron");
                dialog.showErrorBox("配置文件损坏", "将会重置配置以尝试修复 请在之后重新进行部分设置\n带来不便深感抱歉\n如该情况频繁发生请发送反馈");
                const baseConfig = structuredClone(configTemp);
                baseConfig.deviceId = v4().replaceAll("-", "");
                logger.writeInfo("Trying recreate config file", this.LOG_TAG);
                fs.writeJSON(configFile, baseConfig);
                return baseConfig
            }
        } else {
            const baseConfig = structuredClone(configTemp);
            //生成设备id(卸载丢失)
            baseConfig.deviceId = v4().replaceAll("-", "");
            fs.writeJson(configFile, baseConfig);
            logger.writeInfo("Config file created", this.LOG_TAG)
            return baseConfig;
        }
    }
    /**
     * 计算SHA256
     * @param file 文件路径或二进制数据
     * @param isPath 如果file为字符串 是否为文件路径
     * @returns SHA256
     */
    static async getSHA256(file: string | Buffer, isPath?: boolean): Promise<string> {
        const crypto = await import("crypto");
        const hash = crypto.createHash("sha256");
        let fileData;
        if (isPath) {
            fileData = await fs.readFile(file);
        } else {
            fileData = file;
        }
        hash.update(fileData as crypto.BinaryLike);
        return hash.digest("hex");
    }
    /**
     * @description 检查及创建证书
     */
    static async ensureCert() {
        const certPath: string = `${app.getPath("userData")}/programData/cert/`;
        await fs.ensureDir(certPath);
        if (await fs.exists(`${certPath}cert.crt`) && await fs.exists(`${certPath}cert.key`) && await fs.exists(`${certPath}cert.p12`) && await fs.exists(`${certPath}certs.pak`)) {
            logger.writeInfo("Certificate exists", this.LOG_TAG);
            return;
        }
        //crt和key文件
        logger.writeInfo("Generating certificate", this.LOG_TAG);
        const forge = (await import("node-forge")).default
        const randomBytes = forge.random.getBytesSync(16);
        const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
        const cert = forge.pki.createCertificate();
        cert.publicKey = keyPair.publicKey;
        cert.serialNumber = forge.util.bytesToHex(randomBytes).replace(/^0+/, "");
        const date = new Date();
        cert.validity.notBefore = new Date(date.getTime() - 5 * 60 * 1000);
        cert.validity.notAfter = new Date(date.getTime() + 3650 * 24 * 60 * 60 * 1000);
        const certAttr = [
            { name: "countryName", value: "CN" },
            { name: "stateOrProvinceName", value: "Momo" },
            { name: "localityName", value: "Crystal" },
            { name: "organizationName", value: "Suisho" },
            { name: "organizationalUnitName", value: "SuishoApps" },
            { name: "commonName", value: "SuishoConnectorEncryption" },
        ];
        cert.setSubject(certAttr);
        cert.setIssuer(certAttr);
        cert.setExtensions([
            { name: "basicConstraints", cA: false },
            { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
            { name: "extKeyUsage", serverAuth: true },
            { name: "subjectKeyIdentifier" },
        ]);
        logger.writeDebug("Generating certificate .crt and .key", this.LOG_TAG);
        cert.sign(keyPair.privateKey, forge.md.sha256.create());
        const certPem = forge.pki.certificateToPem(cert);
        const keyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
        await fs.writeFile(`${certPath}cert.crt`, certPem);
        await fs.writeFile(`${certPath}cert.key`, keyPem);
        //p12文件
        logger.writeDebug("Generating certificate .p12", this.LOG_TAG);
        const p12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, cert, "SuishoConnectorPwd", {
            algorithm: "3des",
            generateLocalKeyId: true,
            friendlyName: "suishoApps",
        });
        const p12DerBytes = forge.asn1.toDer(p12).getBytes();
        await fs.writeFile(`${certPath}cert.p12`, Buffer.from(p12DerBytes, "binary"));
        //pak文件
        logger.writeDebug("Creating certificate pack", this.LOG_TAG);
        const crtData = await fs.readFile(`${certPath}cert.crt`);
        const p12Data = await fs.readFile(`${certPath}cert.p12`);
        const lenBuf = Buffer.alloc(2);
        lenBuf.writeUInt16BE(crtData.length, 0);
        await fs.writeFile(`${certPath}certs.pak`, Buffer.concat([lenBuf, crtData, p12Data]));
        logger.writeInfo("Certificate generated", this.LOG_TAG);
    }
    static hasDesktopShortcut(): boolean {
        return fs.existsSync(path.resolve(app.getPath("desktop"), `${build.APPLICATION_SHORTCUT_NAME}.lnk`));
    }
    static hasStartMenuShortcut(): boolean {
        return fs.existsSync(path.resolve(`${app.getPath("appData")}/Microsoft/Windows/Start Menu/Programs/${build.APPLICATION_SHORTCUT_NAME}.lnk`));
    }
    static async createStartMenuShortcut(): Promise<void> {
        const { shell } = await import("electron");
        shell.writeShortcutLink(path.resolve(app.getPath("appData"), `Microsoft/Windows/Start Menu/Programs/${build.APPLICATION_SHORTCUT_NAME}.lnk`), "create", { target: process.execPath });
        logger.writeInfo("Created start menu shortcut", this.LOG_TAG);
    }
    static async updateConfig() {
        logger.writeInfo("Loading main config file");
        let hasUpdate = false;
        for (const prop of Object.keys(configTemp)) {
            if (!Reflect.has(global.config, prop)) {
                Reflect.set(global.config, prop, configTemp[prop as keyof typeof configTemp]);
                (global.config as any)[prop] = configTemp[prop as keyof typeof configTemp];
                hasUpdate = true;
            }
        }
        if (hasUpdate) {
            logger.writeInfo("Config format sync success", this.LOG_TAG);
            await this.saveConfig();
        }
    }
    static async saveConfig() {
        await fs.writeJSON(`${app.getPath("userData")}/programData/appCfg.json`, global.config);
        logger.writeDebug("Saving config file success", this.LOG_TAG);
    }
    /**
     * 检测url合规性
     * @param url 
     * @returns 是否为合规url
     */
    static checkUrl(url: string): boolean {
        const result = this.urlRegexp.test(url);
        logger.writeDebug(`Checked url return ${result}:${url}`, this.LOG_TAG);
        return result;
    }
    /**
     * 获取占用目标端口的进程
     * @param port 目标端口
     */
    static async getUsingPortProcessNameAndPid(port: number): Promise<{ name: string, pid: number } | null> {
        const child_process = await import("child_process");
        return new Promise(async (resolve) => {
            child_process.exec(`netstat -ano | findstr "${port}"`, (err, stdout) => {
                if (err) {
                    logger.writeError(`Get using port process id error:${err}`, this.LOG_TAG);
                    resolve(null);
                    return;
                }
                const pid = stdout.slice(stdout.length - 12, stdout.length).replaceAll(" ", "");
                child_process.exec(`tasklist | findstr "${pid}"`, (err2, stdout2) => {
                    if (err) {
                        logger.writeError(`Get using port process name error:${err}`, this.LOG_TAG);
                        resolve(null);
                        return;
                    }
                    const processName = stdout2.slice(0, stdout2.indexOf(".exe") + 4);
                    logger.writeInfo(`Port ${port} is using by ${processName}`, this.LOG_TAG);
                    resolve({ name: processName, pid: parseInt(pid) });
                });
            });
        });
    }
    static async execTaskWithAutoRetry(func: () => boolean, delay: number, maxRetryCount: number, taskName?: string) {
        logger.writeDebug(`New retry task "${taskName ?? "Not name"}" started`, "Retry task");
        for (let index = 0; index < maxRetryCount; index++) {
            const result = func();
            if (!result) {
                if (taskName) logger.writeInfo(`Task "${taskName}" failed.Retry count:${index}`, "Retry task");
                await this.delay(delay);
            } else {
                if (taskName) logger.writeDebug(`Task "${taskName}" success`, "Retry task");
                return
            }
        }
        if (taskName) logger.writeError(`Task "${taskName}" full failed`, "Retry task");
    }
    static async createAes128GcmKey() {
        const crypto = await import("crypto");
        const key = crypto.randomBytes(16);
        const iv = crypto.randomBytes(12);
        return { key: key.toString("base64"), iv: iv.toString("base64") };
    }
    static async registerContextMenu() {
        if (await this.hasSystemContextMenu()) return
        const child_process = await import("child_process");
        // 选项
        child_process.execFileSync("reg", ["add", "HKCU\\Software\\Classes\\*\\shell\\SuishoConnector.TransmitUploadFile", "/f", "/t", "REG_SZ", "/d", "发送到手机", "/ve"]);
        //图标
        child_process.execFileSync("reg", ["add", "HKCU\\Software\\Classes\\*\\shell\\SuishoConnector.TransmitUploadFile", "/f", "/t", "REG_SZ", "/d", process.execPath, "/v", "Icon"]);
        //执行
        child_process.execFileSync("reg", ["add", "HKCU\\Software\\Classes\\*\\shell\\SuishoConnector.TransmitUploadFile\\command", "/f", "/t", "REG_SZ", "/d", `"${process.execPath}" "%1"`]);
    }
    static async unregisterContextMenu() {
        if (!await this.hasSystemContextMenu()) return
        const child_process = await import("child_process");
        child_process.execFileSync("reg", ["delete", "HKCU\\Software\\Classes\\*\\shell\\SuishoConnector.TransmitUploadFile", "/f"]);
    }
    private static async hasSystemContextMenu() {
        try {
            const { execFileSync } = await import("child_process");
            execFileSync("reg", ["query", "HKCU\\Software\\Classes\\*\\shell\\SuishoConnector.TransmitUploadFile"])
            return true
        } catch {
            return false
        }
    }
    //处理未捕获异常
    static onUncaughtException(error: Error, origin: NodeJS.UncaughtExceptionOrigin, mainWindow: BrowserWindow | null) {
        logger.writeError(`New ${origin}`);
        logger.writeError(error);
        import("electron").then(({ dialog }) => {
            //未捕获异常弹窗 给点功能选择
            dialog.showMessageBox({
                type: "error",
                title: "应用程序异常",
                message: `主进程发生异常:\n${error.name}:${error.message}\n${error.stack}`,
                buttons: ["忽略", "重启", "退出"],
                defaultId: 0,
                cancelId: -1
            } as MessageBoxOptions).then((result) => {
                console.log(result.response);
                switch (result.response) {
                    case 0:
                        //忽略
                        logger.writeWarn("User ignored uncaught exception dialog");
                        break;
                    case 1:
                        //重启
                        logger.writeWarn("App relaunching because uncaught exception");
                        mainWindow?.destroy();
                        app.relaunch();
                        app.quit();
                        break;
                    case -1:
                    case 2:
                        //关闭对话框或选择退出
                        logger.writeWarn("App close because uncaught exception");
                        mainWindow?.destroy();
                        app.quit();
                        break;
                }
            });
        });
    }
}
export default Util;
export {
    Config
}