export function parseFileSize(size: number): string {
    if (size < 1024) {
        return `${size} B`
    }
    const sizeKB = size / 1024;
    if (sizeKB < 1024) {
        return `${sizeKB.toFixed(2)} KB`
    }
    const sizeMB = sizeKB / 1024;
    if (sizeMB < 1024) {
        return `${sizeMB.toFixed(2)} MB`
    }
    const sizeGB = sizeMB / 1024;
    if (sizeGB < 1024) {
        return `${sizeGB.toFixed(2)} GB`
    }
    return `${(sizeGB / 1024).toFixed(2)} TB`
}
const urlRegexp = /^(?:https?:\/\/)?(?:(?:[\p{L}\p{N}-]+\.)+[A-Za-z\u00a1-\uffff]{2,}|(?:\d{1,3}\.){3}\d{1,3})(?::\d{2,5})?(?:[/?#][^\s]*)?$/iu;
export function checkUrl(text: string): boolean {
    if (!/^[a-z][\w.+-]*:\/\//i.test(text) && !/[/?#]/.test(text)) {
        return false;
    }
    return urlRegexp.test(text);
}