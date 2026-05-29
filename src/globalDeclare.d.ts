import type { Logger } from "./modules/Logger";
import type { Config } from "./modules/Util";
import type DeviceConfig from "./modules/DeviceConfig";
declare global {
    var logger: Logger
    var config: Config
    var deviceConfig: DeviceConfig
    var clientMetadata: {
        androidId: string | "failed",
        androidSdkVersion: number,
        model: "UnknownModel" | string,
        oem: "UnknownOEM" | string,
        protocolVersion: number,
        toString: Function,
        sessionId: string,
        //旧版本不会上报
        clientVersionCode?: number
    }
}
export { };