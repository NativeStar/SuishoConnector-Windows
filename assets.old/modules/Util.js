class Util{
    static pageId={
        "home":"0",
        "transmit":"1",
        "notificationForward":"3"
    }
    static delay(ms=0){
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, ms);
        })
    }
    /**
     * @description 将文件大小转为字符串类型(大小+单位)
     * @static
     * @param {number} [size=0]
     * @memberof Util
     * @returns {String}
     */
    static parseFileSize(size=0){
        if (size<1024) {
            return `${size} B`
        }
        const sizeKB=size/1024;
        if (sizeKB<1024) {
            return `${sizeKB.toFixed(2)} KB`
        }
        const sizeMB=sizeKB/1024;
        if (sizeMB<1024) {
            return `${sizeMB.toFixed(2)} MB`
        }
        const sizeGB=sizeMB/1024;
        if (sizeGB<1024) {
            return `${sizeGB.toFixed(2)} GB`
        }
        return `${(sizeGB/1024).toFixed(2)} TB`
    }
    /**
     * @static
     * @return {String} UUID
     * @memberof Util
     */
    static generateUUID(){
        return crypto.randomUUID().replaceAll("-","");
    }
}
export default Util