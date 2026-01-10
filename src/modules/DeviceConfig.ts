import IDeviceConfig from "../interface/IDeviceConfig";
import fs from "fs-extra";
import deviceConfigTemplate from "../constant/deviceConfigTemplate";
type prop = string | boolean | number | null;
class DeviceConfig {
    private config: IDeviceConfig;
    private configPath: string;
    private readonly LOG_TAG = "DeviceConfig";
    constructor(configPath: string) {
        this.configPath = configPath;
        if (fs.existsSync(configPath)) {
            try {
                logger.writeInfo("Loading config",this.LOG_TAG)
                this.config = fs.readJsonSync(configPath);
                //更新
                let hasUpdate = false;
                for (const key of Object.keys(deviceConfigTemplate)) {
                    if (!Reflect.has(this.config, key)) {
                        (this.config as any)[key] = deviceConfigTemplate[key as keyof IDeviceConfig];
                        hasUpdate = true;
                    }
                }
                if (hasUpdate) {
                    logger.writeInfo("Config update success",this.LOG_TAG);
                    this.saveConfig();
                }
                logger.writeInfo("Config loaded",this.LOG_TAG)
            } catch (error) {
                logger.writeWarn(`Config load failed.Recreate\n${error}`,this.LOG_TAG)
                //json文件炸了
                //删除并创建
                fs.removeSync(configPath);
                this.config = structuredClone(deviceConfigTemplate) as IDeviceConfig;
                this.saveConfig();
            }
        } else {
            //文件不存在
            logger.writeInfo("Created device config file",this.LOG_TAG);
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
        logger.writeDebug("Saved device config",this.LOG_TAG);
    }
    /**
     * 获取单个配置
     * @param name 配置名
     * @returns 属性
     */
    getConfigProp(name: string, defaultValue?: string | number | boolean | null): prop {
        if (Object.hasOwn(this.config, name)) {
            logger.writeDebug(`Get device config prop ${name}`,this.LOG_TAG);
            return Reflect.get(this.config, name);
        } else {
            logger.writeWarn(`Set device config prop ${name} not found`,this.LOG_TAG);
            return defaultValue ?? null;
        }
    }
    /**
     * 获取所有配置
     * @returns 配置
     */
    getAllConfig(): IDeviceConfig {
        logger.writeDebug("Get device all config",this.LOG_TAG);
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
            logger.writeDebug(`Set device config prop ${prop} to ${value}`,this.LOG_TAG);
            this.saveConfig();
        } else {
            logger.writeWarn(`Set device config prop ${prop} not found`,this.LOG_TAG);
        }
    }
    get enableNotification() {
        return this.config.enableNotificationForward
    }
}
export default DeviceConfig;