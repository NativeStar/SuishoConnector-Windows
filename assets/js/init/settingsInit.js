import * as md from "../../modules/mdui.esm.js";
class Settings {
    // 初始化标记 
    static _initd=false;
    static tempSelect = {
        __oauthSelectChanged: false,
        __cancelProtectMethodChangeEvent: false,
        __heartBestChangeEvent:false,
        __logLevelChangeEvent:false,
        protectMethod: null,
        defaultNotificationShowMode: null,
        heartBeatDelay:null,
        logLevel:null
    }
    static onAppLoaded() {
        this.#initElementEventListener();
        this.#loadSettings();
    }
    static async #initElementEventListener() {
        //阻止目标元素冒泡
        document.querySelectorAll(".notPropagation").forEach(element => {
            element.addEventListener("click", (event) => {
                event.stopPropagation();
            })
        });
        //设置项列表元素
        document.querySelectorAll(".settingListItem").forEach(element => {
            element.addEventListener("click", () => {
                //等于点击开关
                element.children[0].click();
            })
        })

    };
    static async #loadSettings() {
        //获取
        //只适合拿来初始化显示
        const deviceConfig = await window.electronMainProcess.getDeviceAllConfig();
        const globalConfig = await window.electronMainProcess.getAllConfig();
        // console.log(deviceConfig,globalConfig);
        //防空选缓存属性
        this.tempSelect.protectMethod = deviceConfig.protectMethod;
        this.tempSelect.defaultNotificationShowMode = deviceConfig.defaultNotificationShowMode;
        //开关控件
        document.querySelectorAll(".settingSwitch").forEach(element => {
            const key = element.getAttribute("config");
            const type = element.getAttribute("config-type");
            //显示
            switch (type) {
                case "client":
                    element.checked = deviceConfig[key];
                    break;
                case "global":
                    element.checked = globalConfig[key];
                    break;
                default:
                    break;
            }
            //功能
            element.addEventListener("change", async () => {
                if (!this._initd) return
                switch (type) {
                    case "client":
                        await window.electronMainProcess.setDeviceConfig(key, element.checked);
                        break
                    case "global":
                        await window.electronMainProcess.setConfig(key, element.checked);
                        break
                    default:
                        console.warn(`Unknown config type ${type}`);
                }
            })

        });
        //选择控件
        document.querySelectorAll(".settingSelect").forEach(element => {
            const key = element.getAttribute("config");
            const type = element.getAttribute("config-type");
            //显示
            switch (type) {
                case "client":
                    element.value = deviceConfig[key];
                    break;
                case "global":
                    element.value = globalConfig[key];
                    break;
                default:
                    console.warn(`Unknown config type ${type}`);
            }
            //选择框
            element.addEventListener("change", () => {
                if (!this._initd) return
                if (element.value === "") {
                    element.value = this.tempSelect[key];
                } else {
                    this.tempSelect[key] = element.value;
                    switch (type) {
                        case "client":
                            window.electronMainProcess.setDeviceConfig(key, element.value);
                            break;
                        case "global":
                            window.electronMainProcess.setConfig(key, element.value);
                            break;
                        default:
                            console.warn(`Unknown config type ${type}`);
                            break;
                    }
                }
                //如果选择了空 恢复正常勾选状态
                setTimeout(() => {
                    for (const itemElement of element.children) {
                        element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                    }
                }, 120);
            })
        });
        //隐私保护选择框
        //初始值
        document.getElementById("protectMethodSelect").value = deviceConfig.protectMethod;
        //功能
        document.getElementById("protectMethodSelect").addEventListener("change", async (event) => {
            //防止验证失败等多次触发
            if (this.tempSelect.__cancelProtectMethodChangeEvent) {
                this.tempSelect.__cancelProtectMethodChangeEvent = false;
                return
            }
            //初始化时的更改
            if (!this.tempSelect.__oauthSelectChanged) {
                this.tempSelect.__oauthSelectChanged = true;
                return
            }
            const element = event.target;
            if (element.value === "" || element.value === this.tempSelect.protectMethod) {
                //重复选择 恢复
                this.tempSelect.__cancelProtectMethodChangeEvent = true;
                element.value = this.tempSelect.protectMethod;
                setTimeout(() => {
                    for (const itemElement of element.children) {
                        element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                    }
                    this.tempSelect.__cancelProtectMethodChangeEvent = false;
                }, 120);
                return
            }
            //更改生效前用已有的验证方式进行验证
            if (localStorage.getItem(`pwdHash${window.deviceAndroidId}`) !== null) {
                //密码优先
                if (!await this.startVerifyPassword("更改此设置前需要验证", false)) {
                    md.snackbar({
                        message: `验证失败`,
                        autoCloseDelay: 2500
                    });
                    this.tempSelect.__cancelProtectMethodChangeEvent = true;
                    element.value = this.tempSelect.protectMethod;
                    return
                }
            } else if (globalConfig.hasOAuthCredentials) {
                //oauth
                md.snackbar({
                    message: "更改此设置前需要验证",
                    autoCloseDelay: 4500
                });
                if (!await window.electronMainProcess.startAuthorization()) {
                    md.snackbar({
                        message: `验证失败`,
                        autoCloseDelay: 2500
                    });
                    this.tempSelect.__cancelProtectMethodChangeEvent = true;
                    element.value = this.tempSelect.protectMethod;
                    return
                }
            }
            //如果已有配置验证 更改前进行检查
            if (element.value === "oauth") {
                //检测是否存在凭证
                if (!globalConfig.hasOAuthCredentials) {
                    md.snackbar({
                        message: `请在后面弹出的Windows Hello窗口中确认登录`,
                        autoCloseDelay: 4500
                    });
                    if (await window.electronMainProcess.createCredentials()) {
                        this.tempSelect.protectMethod = element.value;
                        md.snackbar({
                            message: `设置成功`,
                            autoCloseDelay: 2500
                        });
                        //保存
                        await window.electronMainProcess.setDeviceConfig("protectMethod", element.value);
                        await window.electronMainProcess.setConfig("hasOAuthCredentials", true);
                        setTimeout(() => {
                            for (const itemElement of element.children) {
                                element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                            }
                        }, 120);
                    } else {
                        md.snackbar({
                            message: `设置失败`,
                            autoCloseDelay: 2500
                        });
                        this.tempSelect.__cancelProtectMethodChangeEvent = true;
                        element.value = this.tempSelect.protectMethod;
                    }
                    return
                } else {
                    //已有凭证 直接切换
                    this.tempSelect.protectMethod = element.value;
                    setTimeout(() => {
                        for (const itemElement of element.children) {
                            element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                        }
                    }, 120);
                    await window.electronMainProcess.setDeviceConfig("protectMethod", element.value);
                }
                return
            } else if (element.value === "password") {
                //密码
                if (localStorage.getItem(`pwdHash_${window.deviceAndroidId}`) === null) {
                    //没密码 创建
                    if (await this.startVerifyPassword("创建新密码", true)) {
                        md.snackbar({
                            message: `设置成功`,
                            autoCloseDelay: 2500
                        });
                        this.tempSelect.protectMethod = element.value;
                        setTimeout(() => {
                            for (const itemElement of element.children) {
                                element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                            }
                        }, 120);
                        await window.electronMainProcess.setDeviceConfig("protectMethod", element.value);
                        return
                    }
                    md.snackbar({
                        message: `设置失败`,
                        autoCloseDelay: 2500
                    });
                    this.tempSelect.__cancelProtectMethodChangeEvent = true;
                    element.value = this.tempSelect.protectMethod;
                } else {
                    //已有密码 直接允许
                    this.tempSelect.protectMethod = element.value;
                    setTimeout(() => {
                        for (const itemElement of element.children) {
                            element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                        }
                    }, 120);
                    await window.electronMainProcess.setDeviceConfig("protectMethod", element.value);
                }
            } else {
                //不保护
                this.tempSelect.protectMethod = element.value;
                await window.electronMainProcess.setDeviceConfig("protectMethod", element.value);
                setTimeout(() => {
                    for (const itemElement of element.children) {
                        element.value === itemElement.value ? itemElement.setAttribute("selected", "") : itemElement.removeAttribute("selected");
                    }
                }, 120);
            }
        });
        //绑定设备
        //文字
        document.getElementById("boundDevice").setAttribute("description", globalConfig.boundDeviceId===null?"未绑定":`已绑定设备ID:${globalConfig.boundDeviceId}`);
        //功能
        document.getElementById("boundDevice").addEventListener("click", async () => {
            /**
             * @type {string}
             */
            const boundDeviceId=await window.electronMainProcess.getConfig("boundDeviceId");
            document.getElementById("boundDevice").blur();
            //如果有windows hello则验证 保证机主操作
            if (globalConfig.hasOAuthCredentials) {
                md.snackbar({
                    message: "此操作需要保证您是机主",
                    autoCloseDelay: 3500
                });
                if (!await window.electronMainProcess.startAuthorization()) {
                    md.snackbar({
                        message: "验证失败",
                        autoCloseDelay: 2000
                    });
                    return
                }
            }
            //已有绑定则改为删除
            if (boundDeviceId===window.deviceAndroidId) {
                md.confirm({
                    headline: "解绑当前连接设备?",
                    description: "将不再自动连接到该设备",
                    confirmText: "解绑",
                    cancelText: "取消",
                    onConfirm: async () => {
                        //写入配置
                        await window.electronMainProcess.sendRequestPacket({packetType:"main_unbindDevice"});
                        window.electronMainProcess.setConfig("boundDeviceId",null);
                        window.electronMainProcess.setConfig("boundDeviceKey",null);
                        md.snackbar({
                            message: "已解绑",
                            autoCloseDelay: 2000
                        });
                        document.getElementById("boundDevice").setAttribute("description", "未绑定");
                    }
                });
                return
            }else if (boundDeviceId !== null) {
                //绑定了 但不是现在连接这个
                md.snackbar({
                    message: "无法执行操作,因为当前连接设备不是绑定的设备",
                    autoCloseDelay: 2500
                });
                return
            }
            md.confirm({
                headline: "绑定当前连接设备?",
                description: "绑定后将在软件打开时自动扫描并连接",
                confirmText: "绑定",
                cancelText: "取消",
                onConfirm: async () => {
                    //发送绑定请求
                    const key=RT.number_en(256);
                    await window.electronMainProcess.sendRequestPacket({packetType:"main_bindDevice",msg:key});
                    //写入配置
                    window.electronMainProcess.setConfig("boundDeviceId",window.deviceAndroidId??null);
                    window.electronMainProcess.setConfig("boundDeviceKey",key);
                    md.snackbar({
                        message: "绑定完成",
                        autoCloseDelay: 2000
                    });
                    document.getElementById("boundDevice").setAttribute("description", `已绑定设备ID:${window.deviceAndroidId}`);
                }
            })
        });
        document.getElementById("changePasswordItem").addEventListener("click",async ()=>{
            if (localStorage.getItem(`pwdHash_${window.deviceAndroidId}`)!==null) {
                if(!await this.startVerifyPassword("请输入旧密码",false)){
                    md.snackbar({
                        message:"验证失败",
                        autoCloseDelay:2000
                    });
                    return
                }
                this.startVerifyPassword("输入新密码",true).then(value=>{
                    md.snackbar({
                        message:value?"修改成功":"修改失败",
                        autoCloseDelay:2000
                    })
                })
            }else{
                this.startVerifyPassword("设置一个密码",true).then(value=>{
                    md.snackbar({
                        message:value?"设置成功":"设置失败",
                        autoCloseDelay:2000
                    })
                })
            }
        });
        //提示
        document.getElementById("heartBeatDelaySelect").addEventListener("change",()=>{
            if (!this.tempSelect.__heartBestChangeEvent) {
                this.tempSelect.__heartBestChangeEvent=true;
                return
            }
            md.snackbar({
                message:"重启程序后生效",
                autoCloseDelay:2500
            })
        });
        document.getElementById("logLevelSelect").addEventListener("change",()=>{
            if (!this.tempSelect.__logLevelChangeEvent) {
                this.tempSelect.__logLevelChangeEvent=true;
                return
            }
            md.snackbar({
                message:"重启程序后生效",
                autoCloseDelay:2500
            })
        });
        //正常0.5秒内是不可能动设置的
        setTimeout(() => {
            this._initd=true;
        }, 500);
    }
    /**
     * 
     * @param {string?} desc 
     * @param {boolean} setPwd 
     * @returns 
     */
    static startVerifyPassword(desc = "输入密码以验证", setPwd = false) {
        return new Promise((resolve, reject) => {
            md.prompt({
                headline: "输入密码",
                description: desc,
                confirmText: "确定",
                cancelText: "取消",
                textFieldOptions: {
                    type: "password"
                },
                /**
                 * @param {string} value 
                 */
                onConfirm: (value) => {
                    const input = value.toString();
                    //空输入
                    if (input.replaceAll(" ", "") === "") {
                        resolve(false);
                        return
                    }
                    const targetHash = localStorage.getItem(`pwdHash_${window.deviceAndroidId}`);
                    if (setPwd) {
                        localStorage.setItem(`pwdHash_${window.deviceAndroidId}`, sha256(input));
                        resolve(true);
                        return
                    }
                    resolve(sha256(input) === targetHash);
                },
                onCancel: () => {
                    resolve(false);
                }
                //库本身有bug
            }).catch(() => { });
        });
    }
}
export default Settings;