import IDeviceConfig from "../interface/IDeviceConfig";
import fs from "fs-extra";
import deviceConfigTemplate from "../constant/deviceConfigTemplate";
type prop = string | boolean | number | null;
class DeviceConfig {
    private config: IDeviceConfig;
    private configPath: string;
    constructor(configPath: string) {
        this.configPath = configPath;
        if (fs.existsSync(configPath)) {
            try {
                logger.writeInfo("Loading device config")
                this.config = fs.readJsonSync(configPath);
                //更新
                let hasUpdate = false;
                for (const key of Object.keys(deviceConfigTemplate)) {
                    if (!Reflect.has(this.config, key)) {
                        (this.config as any)[key] = deviceConfigTemplate[key as keyof IDeviceConfig];
                        hasUpdate = true;
                    }
                }
                hasUpdate&&this.saveConfig();
                logger.writeInfo("Device config async success");
                logger.writeInfo("Device config loaded")
            } catch (error) {
                logger.writeWarn(`Device config load failed. recreate\n${error}`)
                //json文件炸了
                //删除并创建
                fs.removeSync(configPath);
                this.config = structuredClone(deviceConfigTemplate) as IDeviceConfig;
                this.saveConfig();
            }
        } else {
            //文件不存在
            logger.writeInfo("Created device config file");
            //创建
            this.config = structuredClone(deviceConfigTemplate) as IDeviceConfig;
            this.saveConfig();
        }
    }
    /**
     * 保存配置文件
     */
    async saveConfig(): Promise<void> {
        await fs.writeJson(this.configPath, this.config);
        logger.writeDebug("Saved device config");
    }
    /**
     * 获取单个配置
     * @param name 配置名
     * @returns 属性
     */
    getConfigProp(name: string, defaultValue?: string | number | boolean | null): prop {
        if (Object.hasOwn(this.config, name)) {
            logger.writeDebug(`Get device config prop ${name}`);
            return Reflect.get(this.config, name);
        } else {
            logger.writeWarn(`Set device config prop ${name} not found`);
            return defaultValue ?? null;
        }
    }
    /**
     * 获取所有配置
     * @returns 配置
     */
    getAllConfig(): IDeviceConfig {
        logger.writeDebug("Get device all config");
        return this.config;
    }
    /**
     * 写入参数
     * @param prop 
     * @param value 
     */
    setConfig(prop: string, value: string | number | boolean | null) {
        if (Object.hasOwn(deviceConfigTemplate, prop)) {
            Reflect.set(this.config, prop, value);
            logger.writeDebug(`Set device config prop ${prop} to ${value}`);
            this.saveConfig();
        } else {
            logger.writeWarn(`Set device config prop ${prop} not found`);
        }
    }
    get enableNotification() {
        return this.config.enableNotificationForward
    }
}
export default DeviceConfig;