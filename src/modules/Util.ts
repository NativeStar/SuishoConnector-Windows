import fs from "fs-extra";
import crypto from "crypto";
import { app, dialog, shell } from "electron";
import path from "path";
import child_process from 'child_process';
import build from "../constant/build.prop.json";
import configTemp from "../constant/configTemplate";
import { VirtualNetworkDriverName } from "../constant/VirtualNetworkDriverName"
import os from "os";
import forge from "node-forge"
type Config = typeof configTemp;
class Util {
    private static Developing = true;
    //Windows文件名保留字
    private static windowsReservedWords = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
    //url判断正则
    private static urlRegexp = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\*\+,;=.]+$/;
    private static checkNetworkDriverName(name: string) {
        for (const virtualName of VirtualNetworkDriverName) {
            if (name.toLowerCase().includes(virtualName.toLowerCase())) {
                return true;
            }
        }
        return false;
    }
    static delay(ms = 0) {
        return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }
    /**
     * @description 直接照抄
     * @author https://zhuanlan.zhihu.com/p/139212816
     * @static
     * @param {Array} interfaces os.networkInterfaces
     * @memberof Util
     */
    static getIPAdress(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): string | null {
        for (let devName in interfaces) {
            //跳过虚拟网卡 仅排查我碰到过的
            if (this.checkNetworkDriverName(devName)) {
                logger.writeDebug(`Skipping virtual network device:${devName}`);
                continue
            }
            let iface = interfaces[devName];
            if (iface == null) return null;
            for (let i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    return alias.address;
                }
            }
        }
        return null
    }
    /**
     * 
     * @param {String} name 文件名
     * @returns {boolean} 是否含有保留字
     */
    static detectWindowsReservedWords(name: string): boolean {
        const filteredName = name.replaceAll(" ", "");
        return this.windowsReservedWords.has(filteredName);
    }
    /**
     * @description 是否处于开发模式
     *
     * @readonly
     * @static
     * @memberof Util
     */
    static get isDeveloping(): boolean {
        return this.Developing;
    }
    /**
     * @static
     * @return {Object} 
     * @memberof Util
     */
    static async loadConfig(): Promise<typeof config> {
        const { v4 } = require("uuid");
        //文件路径
        const configFile = `${app.getPath("userData")}/programData/appCfg.json`;
        if (await fs.exists(configFile)) {
            //存在
            logger.writeInfo("Config file loaded");
            try {
                return await fs.readJSON(configFile, { encoding: "utf-8" });
            } catch (error) {
                logger.writeError(`Load config file error:${error}`);
                dialog.showErrorBox("配置文件损坏", "将会重置配置以尝试修复 请在之后重新进行部分设置\n带来不便深感抱歉\n如该情况频繁发生请发送反馈");
                const baseConfig = structuredClone(configTemp);
                baseConfig.deviceId = v4().replaceAll("-", "");
                logger.writeInfo("Config file try recreate");
                fs.writeJSON(configFile, baseConfig);
                return baseConfig
            }
        } else {
            const baseConfig = structuredClone(configTemp);
            //生成设备id(卸载丢失)
            baseConfig.deviceId = v4().replaceAll("-", "");
            fs.writeJson(configFile, baseConfig);
            logger.writeInfo("Config file created")
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
     * @static
     * @memberof Util
     */
    static async ensureCert() {
        const certPath: string = `${app.getPath("userData")}/programData/cert/`;
        await fs.ensureDir(certPath);
        if (await fs.exists(`${certPath}cert.crt`) && await fs.exists(`${certPath}cert.key`) && await fs.exists(`${certPath}cert.p12`) && await fs.exists(`${certPath}certs.pak`)) {
            logger.writeInfo("Certificate exists");
            return;
        }
        //crt和key文件
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
        cert.sign(keyPair.privateKey, forge.md.sha256.create());
        const certPem = forge.pki.certificateToPem(cert);
        const keyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
        await fs.writeFile(`${certPath}cert.crt`, certPem);
        await fs.writeFile(`${certPath}cert.key`, keyPem);
        //p12文件
        const p12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, cert, "SuishoConnectorPwd", {
            algorithm: "3des",
            generateLocalKeyId: true,
            friendlyName: "suishoApps",
        });
        const p12DerBytes = forge.asn1.toDer(p12).getBytes();
        await fs.writeFile(`${certPath}cert.p12`, Buffer.from(p12DerBytes, "binary"));
        //pak文件
        const crtData = await fs.readFile(`${certPath}cert.crt`);
        const p12Data = await fs.readFile(`${certPath}cert.p12`);
        const lenBuf = Buffer.alloc(2);
        lenBuf.writeUInt16BE(crtData.length, 0);
        await fs.writeFile(`${certPath}certs.pak`, Buffer.concat([lenBuf, crtData, p12Data]));
    }
    /**
     * @description 创建桌面快捷方式
     * @static
     * @memberof Util
     */
    static createDesktopShortcut(): void {
        shell.writeShortcutLink(path.resolve(app.getPath("desktop"), `${build.APPLICATION_SHORTCUT_NAME}.lnk`), "create", { target: process.execPath });
        logger.writeInfo("Create desktop shortcut");
    }
    static hasDesktopShortcut(): boolean {
        return fs.existsSync(path.resolve(app.getPath("desktop"), `${build.APPLICATION_SHORTCUT_NAME}.lnk`));
    }
    static hasStartMenuShortcut(): boolean {
        return fs.existsSync(path.resolve(`${app.getPath("appData")}/Microsoft/Windows/Start Menu/Programs/${build.APPLICATION_SHORTCUT_NAME}.lnk`));
    }
    static createStartMenuShortcut(): void {
        shell.writeShortcutLink(path.resolve(app.getPath("appData"), `Microsoft/Windows/Start Menu/Programs/${build.APPLICATION_SHORTCUT_NAME}.lnk`), "create", { target: process.execPath });
        logger.writeInfo("Created start menu shortcut");
    }
    static async updateConfig() {
        let hasUpdate = false;
        for (const prop of Object.keys(configTemp)) {
            if (!Reflect.has(global.config, prop)) {
                Reflect.set(global.config, prop, configTemp[prop as keyof typeof configTemp]);
                (global.config as any)[prop] = configTemp[prop as keyof typeof configTemp];
                hasUpdate = true;
            }
        }
        hasUpdate && await this.saveConfig()
        logger.writeInfo("Config format sync success");
    }
    static async saveConfig() {
        await fs.writeJSON(`${app.getPath("userData")}/programData/appCfg.json`, global.config);
    }
    /**
     * 检测url合规性
     * @param url 
     * @returns 是否为合规url
     */
    static checkUrl(url: string): boolean {
        const result = this.urlRegexp.test(url);
        logger.writeDebug(`Checked url return ${result}:${url}`);
        return result;
    }
    /**
     * 获取占用目标端口的进程
     * @param port 目标端口
     */
    static async getUsingPortProcessNameAndPid(port: number): Promise<{ name: string, pid: number } | null> {
        return new Promise(async (resolve, reject) => {
            child_process.exec(`netstat -ano | findstr "${port}"`, (err, stdout) => {
                if (err) {
                    logger.writeError(`Get using port process id error:${err}`);
                    resolve(null);
                    return;
                }
                const pid = stdout.slice(stdout.length - 12, stdout.length).replaceAll(" ", "");
                child_process.exec(`tasklist | findstr "${pid}"`, (err2, stdout2) => {
                    if (err) {
                        logger.writeError(`Get using port process name error:${err}`);
                        resolve(null);
                        return;
                    }
                    const processName = stdout2.slice(0, stdout2.indexOf(".exe") + 4);
                    logger.writeInfo(`Port ${port} is using by ${processName}`);
                    resolve({ name: processName, pid: parseInt(pid) });
                });
            });
        });
    }
    static async execTaskWithAutoRetry(func: () => boolean, delay: number, maxRetryCount: number, taskName?: string) {
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
    static createAes128GcmKey() {
        const key = crypto.randomBytes(16);
        const iv = crypto.randomBytes(12);
        return { key:key.toString("base64"), iv:iv.toString("base64") };
    }
}
export default Util;
export {
    Config
}