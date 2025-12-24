import { type ClassNames } from 'react-modal-video';
const audioFileExtensions = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".wma", ".amr", ".mid"];
const videoFileExtensions = [".mp4", ".webm", ".mkv", ".mov", ".flv", ".wmv"];
const imageFileExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff", ".psd"];
const supportAudioFileExtensions = [".mp3", ".ogg", ".flac","aac","wav","wma"];
const supportVideoFileExtensions = [".mp4", ".webm"];
const supportImageFileExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const fileExtIcon: Record<string, string> = {
    txt: "text_fields",
    log: "text_fields",
    md: "text_snippet",
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    asm: "code",
    xml: "code",
    js: "code",
    css: "code",
    html: "code",
    htm: "code",
    py: "code",
    java: "code",
    kt: "code",
    go: "code",
    rs: "code",
    php: "code",
    vbs: "code",
    c: "code",
    h: "code",
    cpp: "code",
    hpp: "code",
    sql: "code",
    vue: "code",
    cs: "code",
    ts: "code",
    jsx: "code",
    tsx: "code",
    scss: "code",
    sass: "code",
    json: "code",
    yaml: "code",
    yml: "code",
    gradle: "code",
    doc: "text_snippet",
    docx: "text_snippet",
    ppt: "slideshow",
    pptx: "slideshow",
    xls: "table_chart",
    xlsx: "table_chart",
    pdf: "picture_as_pdf",
    exe: "settings_applications",
    dex: "settings_applications",
    arsc: "table_view",
    dll: "settings_applications",
    bat: "settings_applications",
    so: "settings_applications",
    dylib: "settings_applications",
    deb: "settings_applications",
    rpm: "settings_applications",
    apk: "android",
    jar: "settings_applications",
    msi: "settings_applications",
    msm: "settings_applications",
    msix: "settings_applications",
    msixbundle: "settings_applications",
    lnk: "shortcut",
    ttf: "font_download",
    otf: "font_download",
    woff: "font_download",
    woff2: "font_download",
    bak:"backup",
    dat:"data_object",
    sav:"data_object",
    pak:"archive",
    db:"data_array",
    iso:"archive"
}
type FileOpenType = "audio" | "video" | "image" | "none";
export const ModalVideoClassNames: ClassNames = {
    modalVideo: "modal-video modalVideoIndex",
    modalVideoBody: "modal-video-body modalVideoIndex",
    modalVideoClose: "modal-video-close modalVideoIndex",
    modalVideoCloseBtn: "modal-video-close-btn modalVideoIndex",
    modalVideoEffect: "modal-video-effect modalVideoIndex",
    modalVideoIframeWrap: "modal-video-movie-wrap modalVideoIndex",
    modalVideoInner: "modal-video-inner modalVideoIndex"
}
export function getSupportType(fileName: string): FileOpenType {
    if (supportAudioFileExtensions.some((value) => {
        return fileName.endsWith(value);
    })) {
        return "audio"
    };
    if (supportVideoFileExtensions.some((value) => {
        return fileName.endsWith(value);
    })) {
        return "video"
    };
    if (supportImageFileExtensions.some((value) => {
        return fileName.endsWith(value);
    })) {
        return "image"
    }
    return "none"
}
export function getFileTypeIcon(fileName: string) {
    //音频
    if (audioFileExtensions.some((value) => {
        return fileName.endsWith(value);
    })) {
        return "music_note"
    };
    //视频
    if (videoFileExtensions.some((value) => {
        return fileName.endsWith(value);
    })) {
        return "movie"
    };
    //图片
    if (imageFileExtensions.some((value) => {
        return fileName.endsWith(value);
    })) {
        return "image"
    };
    if (Reflect.has(fileExtIcon, fileName.slice(fileName.lastIndexOf(".") + 1))) {
        return fileExtIcon[fileName.slice(fileName.lastIndexOf(".") + 1)];
    }
    return "insert_drive_file"
}