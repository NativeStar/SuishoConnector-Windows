//ui库
import * as md from "../../modules/mdui.esm.js";
import * as musicMetadataInit from "../../modules/audio/audioMetadata/musicMetadata.js";
void musicMetadataInit;
void md;
const params = new URLSearchParams(location.search);
const playerProgressBar = document.getElementById("audioPlayerCurrentTime");
const pauseButton = document.getElementById("pauseButton");
const titleTextElement = document.getElementById("textTitle");
const artistTextElement = document.getElementById("textArtist");
const lyricsListElement = document.getElementById("lyricsList");
const playerCurrentTimeTextELement=document.getElementById("playerCurrentTime");
/**
 * @type {Array<{timestamp:number,text:string,index:number}>}
 */
let lyric = [];
const audioPlayer = new Audio();
//init
(async () => {
    //加载动画 如果音频文件内没有封面的话则兼职播放动画
    setupPlayAnimation();
    try {
        const rawFetch = await fetch(`https://${params.get("remoteAddr")}:30767?filePath=${params.get("filePath")}`);
        if (rawFetch.status !== 200) {
            md.alert({
                headline: "读取文件失败",
                description: `错误码:${rawFetch.status}\n详情:${await rawFetch.text()}`,
                confirmText: "关闭",
                onConfirm: () => window.close()
            });
            //
            audioPlayer.remove();
            // audioPlayer=null;
            return
        }
        const audioBlob = await rawFetch.blob();
        audioPlayer.addEventListener("error", async (error) => {
            // console.error(error);
            if (params.get("filePath").endsWith(".flac")) {
                //原生不支持播放 转码
                const flacDecoder = new window["flac-decoder"].FLACDecoder();
                await flacDecoder.ready;
                const reader = new FileReader();
                reader.addEventListener("loadend", async () => {
                    const uint8Array = new Uint8Array(reader.result);
                    const pcmData = await flacDecoder.decode(uint8Array);
                    flacDecoder.free();
                    const wavData = encodeToWav(pcmData.channelData, pcmData.sampleRate, pcmData.samplesDecoded);
                    const wavBlob = new Blob([wavData], { type: "audio/wav" });
                    audioPlayer.src = URL.createObjectURL(wavBlob);
                    audioPlayer.play();
                });
                reader.readAsArrayBuffer(audioBlob);
            }else{
                md.alert({
                    headline: "播放失败",
                    description: "播放文件时发生异常",
                    confirmText: "关闭",
                    onConfirm: () => window.close()
                });
                audioPlayer.remove();
                // audioPlayer=null;
                return
            }
        });
        audioPlayer.addEventListener("canplaythrough", () => {
            document.getElementById("playerTotalTime").innerText=time2str(audioPlayer.duration);
            audioPlayer.play();
            pauseButton.disabled = false;
        });
        audioPlayer.addEventListener("loadeddata", () => {
            playerProgressBar.setAttribute("max", Math.floor(audioPlayer.duration));
            readMetadata(audioBlob);
        })
        audioPlayer.addEventListener("timeupdate", () => {
            playerCurrentTimeTextELement.innerText=time2str(audioPlayer.currentTime);
            playerProgressBar.value = Math.floor(audioPlayer.currentTime);
            if (lyric.length > 0) updateLyric();
        });
        audioPlayer.addEventListener("ended", () => {
            pauseButton.setAttribute("icon", "play_arrow");
        });
        playerProgressBar.addEventListener("input", () => {
            audioPlayer.currentTime = playerProgressBar.value;
            pauseButton.setAttribute("icon", "pause");
        });
        audioPlayer.src = URL.createObjectURL(audioBlob);
    } catch (error) {
        console.error(error);
    }
})();
//窗口焦点事件 改变标题文本颜色
window.addEventListener("focus", () => {
    document.getElementById("titleBar").classList.add("titleBarNotFocus");
});
window.addEventListener("blur", () => {
    document.getElementById("titleBar").classList.remove("titleBarNotFocus");
});
document.addEventListener("keydown", event => {
    if (event.key === "F5") {
        window.location.reload()
    }
});
document.addEventListener("keyup", event => {
    //空格键
    if (event.key === " ") {
        pauseButton.click();
        event.preventDefault();
        event.stopPropagation();
    }
});
document.getElementById("lyricButton").addEventListener("click", () => {
    const audioPicture = document.getElementById("audioPicture");
    lyricsListElement.hidden = !lyricsListElement.hidden;
    audioPicture.hidden = !audioPicture.hidden;
})
function setupPlayAnimation() {
    const audioPicture = document.getElementById("audioPicture");
    audioPicture.src = "../bitmaps/audioPlayerNotPicture.png";
    const degList = [60, 120, 180, 240, 300, 360];
    let aniIndex = 0;
    const looper = setInterval(() => {
        if (!audioPicture.src.startsWith("data:image")) {
            if (aniIndex >= degList.length) {
                aniIndex = 0;
            }
            audioPicture.style.rotate = `${degList[aniIndex]}deg`;
            aniIndex++;
        } else {
            //已有封面
            clearInterval(looper);
        }
    }, 200);
}
async function readMetadata(audioBlob) {
    try {
        const metadata = (await window.MusicMetadata.parseBlob(audioBlob)).common
        // console.log(metadata);
        //封面
        if (metadata.picture && metadata.picture[0]) {
            /**
             * @type {Uint8Array}
             */
            const imageData = metadata.picture[0].data;
            let base64String = "";
            for (let i = 0; i < imageData.length; i++) {
                base64String += String.fromCharCode(imageData[i]);
            }
            document.getElementById("audioPicture").src = `data:${metadata.picture[0].format};base64,${btoa(base64String)}`;
            document.getElementById("audioPicture").style.rotate = "0deg";
        }
        //曲名和歌手
        if (metadata.title && metadata.artist) {
            titleTextElement.innerText = metadata.title;
            document.title = `${metadata.title} - ${metadata.artist}`;
        } else if (metadata.title) {
            titleTextElement.innerText = metadata.title;
            document.title = `${metadata.title}`;
        } else {
            titleTextElement.innerText = "未知曲名";
            document.title = `音频播放器:未知曲名`;
        };
        //歌词
        // console.log(metadata.lyrics);
        //部分格式只解析出字符串 自行解析
        if(metadata?.lyrics[0]?.text){
            const lrcDecoder=new Lyrics(metadata.lyrics[0].text);
            const tempLyric=new Array();
            for (const lyricItem of lrcDecoder.lyrics_all) {
                tempLyric.push({timestamp:lyricItem.timestamp*1000,text:lyricItem.text});
            }
            lyric=tempLyric;
            initLyrics();
        }else if (metadata?.lyrics[0]?.syncText?.length > 0) {
            lyric = metadata.lyrics[0].syncText;
            initLyrics();
        }
        artistTextElement.innerText = metadata.artist ? metadata.artist : "未知歌手";
        document.getElementById("textAlbum").innerText = metadata.album ? metadata.album : "未知专辑";

    } catch (error) {
        console.error(error);
        titleTextElement.innerText = "未知曲名";
        document.title = `音频播放器:未知曲名`;
        artistTextElement.innerText = "未知歌手";
        document.getElementById("textAlbum").innerText = "未知专辑";
    }
}
pauseButton.addEventListener("click", async () => {
    audioPlayer.paused ? audioPlayer.play() : audioPlayer.pause();
    pauseButton.setAttribute("icon", audioPlayer.paused ? "play_arrow" : "pause");
});
function initLyrics() {
    let index = 0;
    for (const lyricItem of lyric) {
        const lyricTextElement = document.createElement("spam");
        lyricTextElement.classList.add("lyricText");
        lyricTextElement.innerText = lyricItem.text;
        // lyricTextElement.style.color = "gray";
        const lyricTextGroup = document.createElement("div");
        lyricTextGroup.append(lyricTextElement, document.createElement("br"), document.createElement("br"));
        lyricsListElement.appendChild(lyricTextGroup);
        lyricItem.index = index;
        index++;
    }
    document.getElementById("lyricButton").disabled = false;
}
function updateLyric() {
    const currentTimeMs = audioPlayer.currentTime * 1000;
    for (const lyricItem of lyric) {
        if (lyricItem.timestamp <= currentTimeMs) {
            for (const lyricTextElement of lyricsListElement.children) {
                lyricTextElement.style.color = "gray";
            }
            lyricsListElement.children[lyricItem.index].style.color = "red";
            //滚动到中间
            lyricsListElement.scrollTo({
                top: lyricsListElement.children[lyricItem.index].offsetTop - lyricsListElement.clientHeight / 2,
                behavior: "smooth"
            });
        }
    }
}
function time2str(time) {
    const second=Math.floor(time);
    return `${Math.floor(second / 60)}:${second % 60 < 10 ? "0" + second % 60 : second % 60}`;
}