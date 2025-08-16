import * as md from "../../modules/mdui.esm.js";
import RightClickMenuItem from "../../js/class/RightClickMenuItem.js";
import RightClickMenus from "../../js/class/RightClickMenus.js";
import ResultCodes from "../../js/class/FileManagerResultCode.js";
class FileManager {
    /**
     * @typedef {Object} FileObject
     * @property {"folder"|"file"} type
     * @property {string} name
     * @property {number} size 
    */
    /**
     *@type {string[]}
     *
     * @memberof FileManager
     */
    static #pathArray = [];
    static #listFragment = document.createDocumentFragment();
    //是否有管理全部文件权限
    static #hasManagerAllFilesPermission = false;
    static #backElement = FileManager.#createBackItem();
    static #fileListElement = document.getElementById("fileManagerFilesListContent");
    static #fileLoadingMark = document.getElementById("fileManagerLoadingMark");
    static #fileManagerTipTextElement = document.getElementById("fileManagerTipText");
    /**
     * @type {HTMLInputElement}
     * @memberof FileManager
     */
    static #fileFilterInput = document.getElementById("fileManagerFileFilterInput");
    static #fileFilterCapsButton = document.getElementById("fileManagerFileFilterCapsButton");
    static #audioFileExtensions = [".mp3", ".flac", ".wav", ".ogg"];
    static #videoFileExtensions = [".mp4", ".webm"];
    static #imageFileExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp"];
    static #fileExtIcon = {
        txt: "text_fields",
        log: "text_fields",
        zip: "archive",
        rar: "archive",
        "7z": "archive",
        xml: "code",
        js: "code",
        css: "code",
        html: "code",
        py: "code",
        java: "code",
        c: "code",
        cpp: "code",
        cs: "code",
        json: "code"
    }
    static init() {
        this.#checkManagerAllFilePermission();
        //返回上一级
        this.#backElement.addEventListener("click", () => {
            this.#back();
        });
        document.getElementById("fileManagerPage").addEventListener("mousedown", event => {
            if (event.button === 3) {
                event.preventDefault();
                event.stopPropagation();
                this.#back();
            }
        });
        document.getElementById("fileManagerOpenFileFilterCardMenu").addEventListener("click", () => {
            if (this.#fileManagerTipTextElement.hidden) {
                const searchCard = document.getElementById("fileManagerFileFilterCard");
                searchCard.style.display = searchCard.style.display === "none" ? "block" : "none";
                //不延迟焦点挂不上
                setTimeout(() => {
                    if (searchCard.style.display === "block") this.#fileFilterInput.focus();
                }, 75);
            } else {
                md.snackbar({
                    message: "当前无法进行搜索",
                    autoCloseDelay: 2000
                });
            }
        })
        //过滤关键词清空后恢复显示
        this.#fileFilterInput.addEventListener("clear", () => {
            this.#filterFileList("", false);
        });
        for (const element of document.getElementsByClassName("fileManagerOpenDirectoryButton")) {
            element.addEventListener("click", async () => {
                if (!this.#hasManagerAllFilesPermission) {
                    md.alert({
                        headline: "获取权限失败",
                        description: "请给予安卓端'管理所有文件'权限",
                        confirmText: "刷新",
                        onConfirm: () => { this.#checkManagerAllFilePermission() }
                    });
                    return
                }
                const targetPath = element.getAttribute("path");
                if (targetPath !== "") {
                    this.#pathArray = ["/storage/emulated/0", targetPath];
                } else {
                    this.#pathArray = ["/storage/emulated/0"];
                }
                this.openPath(this.#pathArray.join("/"));
            });
        };
        //收藏列表箭头切换
        document.getElementById("fileManagerDirectoryListStaredDirectoryListCollapse").addEventListener("open", () => {
            document.getElementById("fileManagerDirectoryListStaredDirectoryArrowIcon").setAttribute("name", "keyboard_arrow_up");
        });
        document.getElementById("fileManagerDirectoryListStaredDirectoryListCollapse").addEventListener("close", () => {
            document.getElementById("fileManagerDirectoryListStaredDirectoryArrowIcon").setAttribute("name", "keyboard_arrow_down");
        });
        document.getElementById("fileManagerMenuAddToStar").addEventListener("click", () => {
            const currentPath = this.#pathArray.join("/");
            const staredDir = localStorage.getItem("fileManagerStaredDirectory");
            if (staredDir === null) {
                localStorage.setItem("fileManagerStaredDirectory", JSON.stringify([currentPath]));
            } else {
                const staredDirArray = JSON.parse(staredDir);
                if (!staredDirArray.includes(currentPath)) {
                    staredDirArray.push(currentPath);
                    localStorage.setItem("fileManagerStaredDirectory", JSON.stringify(staredDirArray));
                }
            }
            md.snackbar({
                message: "已收藏",
                autoCloseDelay: 1500
            });
            document.getElementById("fileManagerDirectoryListStaredDirectoryListCollapse").appendChild(this.#createStaredDirectoryItem(currentPath))
            console.log(currentPath);
        });
        document.getElementById("fileManagerMenuRefresh").addEventListener("click", () => {
            this.openPath(this.#pathArray.join("/"));
        });
        //收藏列表
        const staredDir = localStorage.getItem("fileManagerStaredDirectory");
        if (staredDir !== null) {
            /**
             * @type {string[]}
             */
            const staredDirArray = JSON.parse(staredDir);
            const fragment = document.createDocumentFragment();
            for (const dir of staredDirArray) {
                fragment.appendChild(this.#createStaredDirectoryItem(dir));
            }
            document.getElementById("fileManagerDirectoryListStaredDirectoryListCollapse").appendChild(fragment);
        };
        //过滤文件
        //搜索框回车
        this.#fileFilterInput.addEventListener("keydown", event => {
            if (event.key === "Enter") this.#filterFileList(this.#fileFilterInput.value, this.#fileFilterCapsButton.selected);
        });
        //搜索按钮
        document.getElementById("fileManagerFileFilterSearchButton").addEventListener("click", () => this.#filterFileList(this.#fileFilterInput.value, this.#fileFilterCapsButton.selected));
        //关闭按钮
        document.getElementById("fileManagerFileFilterCloseButton").addEventListener("click", () => {
            this.#fileFilterInput.value = "";
            document.getElementById("fileManagerFileFilterCard").style.display = "none";
        });
    };
    static requestFilterCard() {
        if (this.#fileManagerTipTextElement.hidden) {
            const searchCard = document.getElementById("fileManagerFileFilterCard");
            searchCard.style.display = searchCard.style.display === "none" ? "block" : "none";
            if (searchCard.style.display === "block") this.#fileFilterInput.focus();
        }
    }
    static #createBackItem() {
        const backElement = document.createElement("mdui-list-item");
        backElement.setAttribute("icon", "keyboard_backspace");
        backElement.innerText = "..";
        return backElement;
    }
    /**
     * 
     * @param {string} path 
     */
    static async openPath(path) {
        document.getElementById("fileManagerFileFilterCard").style.display = "none";
        this.#fileManagerTipTextElement.hidden = true;
        this.#fileLoadingMark.hidden = false;
        if (!path.endsWith("/")) {
            path += "/";
        }
        /**
          * @type {{code:number,files:FileObject[]}}
        */
        const filesList = await window.electronMainProcess.getPhoneDirectoryFiles(path);
        //
        if (filesList.code === ResultCodes.CODE_FUNCTION_DISABLED || filesList.code === ResultCodes.CODE_DEVICE_NOT_TRUSTED) {
            md.snackbar({
                message: filesList.code === ResultCodes.CODE_FUNCTION_DISABLED ? "文件浏览功能被关闭\n请在手机端打开后重试" : "设备不受信任\n请在手机端信任此计算机后重试",
                autoCloseDelay: 2000
            });
            this.#pathArray.pop();
            this.#fileLoadingMark.hidden = true;
            return
        };
        //不是目录 可能是文件夹被删了或者bug
        if (filesList.code === ResultCodes.CODE_NOT_DIR) {
            md.snackbar({
                message: "无法打开该目录",
                autoCloseDelay: 2000
            });
            this.#pathArray.pop();
            this.#fileLoadingMark.hidden = true;
            return
        }
        //正常
        if (filesList.code === ResultCodes.CODE_NORMAL) {
            //生成列表
            this.#listFragment.replaceChildren();
            //追加返回上一级选项
            if (this.#pathArray.length > 1) this.#listFragment.appendChild(this.#backElement);
            filesList.files.sort((a, b) => {
                if (a.type === "folder" && b.type === "file") return -1;
                if (a.type === "file" && b.type === "folder") return 1;
                return 0;
            });
            for (const fileObject of filesList.files) {
                const fileElement = document.createElement("mdui-list-item");
                fileElement.setAttribute("icon", fileObject.type === "folder" ? "folder" : this.#getFileIcon(fileObject.name));
                fileElement.innerText = fileObject.name;
                fileElement.addEventListener("click", () => {
                    // console.log(fileElement, fileElement.innerText);
                    if (fileObject.type === "folder") {
                        this.#pathArray.push(fileElement.innerText);
                        this.openPath(this.#pathArray.join("/"));
                    } else {
                        //打开文件
                        //音频
                        if (this.#audioFileExtensions.some((value) => {
                            return fileObject.name.endsWith(value);
                        })) {
                            window.electronMainProcess.openRemoteMediaPlayerWindow("audio", this.#pathArray.join("/") + "/" + fileObject.name.replaceAll("+","%2b"));
                        };
                        //视频
                        if (this.#videoFileExtensions.some((value) => {
                            return fileObject.name.endsWith(value);
                        })) {
                            window.electronMainProcess.openRemoteMediaPlayerWindow("video", this.#pathArray.join("/") + "/" + fileObject.name);
                        };
                        //图片
                        if (this.#imageFileExtensions.some((value) => {
                            return fileObject.name.endsWith(value);
                        })) {
                            window.electronMainProcess.openRemoteMediaPlayerWindow("image", this.#pathArray.join("/") + "/" + fileObject.name);
                        };
                    }
                });
                if (fileObject.type === "file") {
                    fileElement.addEventListener("contextmenu", async (event) => {
                        const result = await window.electronMainProcess.createRightClickMenu(RightClickMenus.MENU_FILE_MANAGER_FILE_ITEM);
                        if (result === 10) {
                            const filePath = this.#pathArray.join("/") + "/" + event.target.innerText;
                            console.log(filePath);
                            //下载
                            window.electronMainProcess.downloadPhoneFile(filePath)
                        }
                    });
                }
                this.#listFragment.appendChild(fileElement);
            };
            //空目录
            if (filesList.files.length === 0) {
                this.#fileManagerTipTextElement.innerText = "该目录为空";
                this.#fileManagerTipTextElement.hidden = false;
            } else {
                document.getElementById("fileManagerTipText").hidden = true;
            }
            document.getElementById("fileManagerMenuFab").style.display = "block";
            this.#fileListElement.replaceChildren();
            this.#fileListElement.appendChild(this.#listFragment);
            this.#fileListElement.scrollTo(0, 0);
        } else if (filesList.code === ResultCodes.CODE_NOT_PERMISSION) {
            md.snackbar({
                message: "软件无权访问该目录",
                autoCloseDelay: 2000
            });
            this.#pathArray.pop();
        }
        this.#fileLoadingMark.hidden = true;
    }
    static #checkManagerAllFilePermission() {
        window.electronMainProcess.checkAndroidClientPermission("android.permission.MANAGE_EXTERNAL_STORAGE").then(value => {
            if (!value.result) {
                this.#hasManagerAllFilesPermission = false;
                document.getElementById("fileManagerTipText").innerText = "设备未开启相关权限";
            } else {
                this.#hasManagerAllFilesPermission = true;
                document.getElementById("fileManagerTipText").innerText = "选择一个目录开始浏览文件";
            }
        });
    }
    static #createStaredDirectoryItem(dirName) {
        const dirElement = document.createElement("mdui-list-item");
        dirElement.setAttribute("icon", "star_outline");
        dirElement.innerText = dirName.slice(dirName.lastIndexOf("/") + 1);
        //打开
        dirElement.addEventListener("click", () => {
            this.#pathArray = dirName.split("/");
            this.openPath(this.#pathArray.join("/"));
        });
        //右键
        dirElement.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            const result = await window.electronMainProcess.createRightClickMenu(RightClickMenus.MENU_FILE_MANAGER_STARED_DIRECTORY);
            if (result === RightClickMenuItem.Delete) {
                //删除收藏
                /**
                * @type {string[]}
                */
                const staredDirArray = JSON.parse(localStorage.getItem("fileManagerStaredDirectory"));
                staredDirArray.splice(staredDirArray.indexOf(dirName), 1);
                localStorage.setItem("fileManagerStaredDirectory", JSON.stringify(staredDirArray));
                dirElement.remove();
            }
        });
        return dirElement;
    }
    static #getFileIcon(fileName = "") {
        //音频
        if (this.#audioFileExtensions.some((value) => {
            return fileName.endsWith(value);
        })) {
            return "music_note"
        };
        //视频
        if (this.#videoFileExtensions.some((value) => {
            return fileName.endsWith(value);
        })) {
            return "movie"
        };
        //图片
        if (this.#imageFileExtensions.some((value) => {
            return fileName.endsWith(value);
        })) {
            return "image"
        };
        if (Reflect.has(this.#fileExtIcon, fileName.slice(fileName.lastIndexOf(".") + 1))) {
            return this.#fileExtIcon[fileName.slice(fileName.lastIndexOf(".") + 1)];
        }
        return "insert_drive_file"
    }
    static #back() {
        if (this.#pathArray.length <= 1) {
            return
        }
        this.#pathArray.pop();
        this.openPath(this.#pathArray.join("/"));
    }
    /**
     * 根据关键词过滤文件列表
     * @param {string} targetName 目标文件名
     * @param {boolean} caps 是否区分大小写
     */
    static #filterFileList(targetName = "", caps = false) {
        const fileList = this.#fileListElement.children;
        //恢复显示
        if (targetName === "") {
            for (const fileElement of fileList) {
                fileElement.style.display = "";
            }
            return;
        }
        let firstElement = true;
        for (const fileElement of fileList) {
            //首个元素可能是返回上一级目录的控制元素
            if (firstElement && fileElement.innerText === "..") {
                firstElement = false;
                continue
            }
            if ((caps ? fileElement.innerText : fileElement.innerText.toLowerCase()).includes(caps ? targetName : targetName.toLowerCase())) {
                fileElement.style.display = "";
            } else {
                fileElement.style.display = "none";
            }
        }
    }
}
export default FileManager;