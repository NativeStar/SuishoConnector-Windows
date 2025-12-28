import isPortAvailable from "is-port-available";
import randomThing from "randomthing-js";
import fs from "fs-extra";
import crypto from "crypto";
import { app, dialog, shell } from "electron";
import path from "path";
import child_process from 'child_process';
import build from "../constant/build.prop.json";
import configTemp from "../constant/configTemplate";
import os from "os";
type Config = typeof configTemp;
class Util {
    static #DEVELOPING = true;
    //Windows文件名保留字
    static windowsReservedWords = new Set(["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"]);
    //url判断正则
    static urlRegexp = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\*\+,;=.]+$/;
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
            const deviceNameLowCase = devName.toLowerCase();
            if (deviceNameLowCase.includes("vmware") || deviceNameLowCase.includes("vethernet") || deviceNameLowCase.includes("virtual")) {
                logger.writeDebug(`Skipping virtual network device:${devName}`);
                continue
            }
            let iface = interfaces[devName] /* as unknown as os.NetworkInterfaceInfo[] */;
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
     * @description 寻找可用端口
     * @static
     * @memberof Util
     */
    static async findUsablePort(): Promise<{ state: boolean, port: number | null }> {
        let port: number;
        let loopCount = 0;
        while (true) {
            port = randomThing.number(1, 60000);
            if (await isPortAvailable(port)) {
                return { state: true, port: port }
            }
            loopCount++;
            //超过次数报找不到端口
            if (loopCount >= 60000) {
                return { state: false, port: null }
            }
        }
    }
    /**
     * @description 是否正在开发 getter
     *
     * @readonly
     * @static
     * @memberof Util
     */
    static get isDeveloping(): boolean {
        return this.#DEVELOPING;
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
        return new Promise<void>(async (resolve, reject) => {
            const certPath: string = `${app.getPath("userData")}/programData/cert/`;
            await fs.ensureDir(certPath);
            if (await fs.exists(`${certPath}cert.crt`) && await fs.exists(`${certPath}cert.key`) && await fs.exists(`${certPath}cert.p12`) && await fs.exists(`${certPath}certs.pak`)) {
                logger.writeInfo("Certificate exists");
                resolve();
                return;
            }
            logger.writeInfo("creating certificate");
            const opensslProcess = child_process.exec(`"${path.resolve("./lib/openssl/openssl.exe")}" req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout "${certPath}cert.key" -out "${certPath}cert.crt" -config "${path.resolve("./lib/openssl/openssl.cnf")}" -subj "/C=CN/ST=Momo/L=Crystal/O=Suisho/OU=SuishoApps/CN=SuishoConnectorEncryption"`);
            opensslProcess.on("exit", () => {
                const opensslP12Process = child_process.exec(`"${path.resolve("./lib/openssl/openssl.exe")}" pkcs12 -export -in "${certPath}cert.crt" -inkey "${certPath}cert.key" -out "${certPath}cert.p12" -name "suishoApps" -passout pass:SuishoConnectorPwd`);
                opensslP12Process.on("exit", async () => {
                    //创建合并的文件
                    const crtFileBuffer = await fs.readFile(path.resolve(`${certPath}cert.crt`));
                    const p12FileBuffer = await fs.readFile(path.resolve(`${certPath}cert.p12`));
                    //以.crt证书文件大小为分割判断依据
                    const crtFileSizeDataBuffer = Buffer.alloc(2);
                    crtFileSizeDataBuffer.writeInt16BE(crtFileBuffer.length);
                    const outFileBuffer = Buffer.concat([new Uint8Array(crtFileSizeDataBuffer), new Uint8Array(crtFileBuffer), new Uint8Array(p12FileBuffer)]);
                    fs.writeFile(path.resolve(`${certPath}certs.pak`), new Uint8Array(outFileBuffer));
                    logger.writeInfo("Created certificate");
                    //保证证书完成生成 避免加载到空证书
                    setTimeout(() => {
                        resolve();
                    }, 500);
                })
            })
            //防止进程干完活赖着不走 虽然这跟Electron比根本不算啥
            setTimeout(() => {
                if (opensslProcess.exitCode === null) opensslProcess.kill();
            }, 10000);
        })
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
        //配置格式版本
        if (global.config._cfgVersion === configTemp._cfgVersion) {
            logger.writeInfo(`Config format version:${configTemp._cfgVersion}`);
            return
        }
        for (const prop of Object.keys(configTemp)) {
            if (!Reflect.has(global.config, prop)) {
                Reflect.set(global.config, prop, configTemp[prop as keyof typeof configTemp]);
                // global.config[prop as keyof typeof config] = configTemp[prop];
            }
        }
        global.config._cfgVersion = configTemp._cfgVersion;
        logger.writeInfo(`Config format version updated to:${configTemp._cfgVersion}`);
        await this.saveConfig()
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
}
export default Util;
export {
    Config
}