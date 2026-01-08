import { useRef, useState } from "react";
import "mdui/components/slider"
import { ensureFfmpegLoaded, time2str } from "~/utils";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { parseBuffer } from "music-metadata"
import { useAsyncEffect } from "use-async-effect"
import AutoScrollLyric, { type LyricItemType } from "./AutoScrollLyric";
import { alert } from "mdui";
// 旋转动画角度
const rotateList = [60, 120, 180, 240, 300, 360];

interface AudioModalProps {
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
    src: string
}
type AudioMetadata = {
    title: string,
    artist: string,
    album: string,
};
export default function AudioModal({ setVisible, src }: AudioModalProps) {
    let ffmpegInstance: FFmpeg;
    const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(new Audio());
    const [duration, setDuration] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [sliderValue, setSliderValue] = useState<number>(0);
    const [paused, setPaused] = useState<boolean>(false);
    const [rotate, setRotate] = useState<number>(0);
    const [lyric, setLyric] = useState<LyricItemType[]>([]);
    const [enableLyricAutoScroll, setEnableLyricAutoScroll] = useState<boolean>(false);
    const imageRef = useRef<HTMLImageElement | null>(null);
    // 防止进度条拖动时闪烁
    const userControllingSlider = useRef<boolean>(false);
    let imageUrl: string;
    function onAudioMetadataLoaded() {
        setDuration(() => audioRef.current?.duration ?? 0);
        audioRef.current?.removeEventListener("loadedmetadata", onAudioMetadataLoaded);
    }
    function onAudioTimeUpdate() {
        setCurrentTime(() => audioRef.current?.currentTime ?? 0)
        if (!userControllingSlider.current) {
            setSliderValue(() => audioRef.current?.currentTime ?? 0)
        }
    }
    function onAudioEnded() {
        setPaused(true);
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
        setSliderValue(() => 0);
    }
    useAsyncEffect(async (isMounted) => {
        let aniIndex = 0;
        const looper = setInterval(() => {
            if (!imageRef.current?.src.startsWith("data:image")) {
                if (aniIndex >= rotateList.length) {
                    aniIndex = 0;
                }
                setRotate(rotateList[aniIndex]);
                aniIndex++;
            } else {
                //已有封面
                clearInterval(looper);
            }
        }, 200);
        // ffmpeg
        ffmpegInstance = await ensureFfmpegLoaded();
        const rawFetchData = await fetch(src, { cache: "no-store" });
        if (rawFetchData.status!==200) {
            alert({
                headline: "加载失败",
                description: `无法加载音频文件:${rawFetchData.status}`,
                confirmText: "关闭",
                onConfirm:()=>{
                    setVisible(false);
                }
            })
            return
        }
        const fileData = await rawFetchData.arrayBuffer();
        //解码 使用无损flac
        if (!isMounted()) return () => {
            clearInterval(looper);
        }
        //元数据
        const audioMetadata = await parseBuffer(new Uint8Array(fileData));
        setMetadata({
            title: audioMetadata.common.title ?? "未知曲名",
            artist: audioMetadata.common.artist ?? "未知歌手",
            album: audioMetadata.common.album ?? "未知专辑",
        });
        const lyricArray = audioMetadata.common.lyrics?.[0].syncText;
        setLyric(lyricArray ?? []);
        setEnableLyricAutoScroll((lyricArray?.length ?? 0) > 0);
        if (audioMetadata.common.picture && audioMetadata.common.picture[0]) {
            const picture = audioMetadata.common.picture[0];
            const coverBlob = new Blob([picture.data as unknown as BlobPart], { type: picture.format });
            imageUrl = URL.createObjectURL(coverBlob);
            imageRef.current!.src = imageUrl
            clearInterval(looper);
            setRotate(() => 0);
        }
        await ffmpegInstance.writeFile("tmpAudioInput", new Uint8Array(fileData));
        await ffmpegInstance.exec(["-i", "tmpAudioInput", "-f", "flac", "tmpAudioOutput"]);
        // 释放原始输入 它的任务结束了
        await ffmpegInstance.deleteFile("tmpAudioInput");
        const finalAudioData = await ffmpegInstance.readFile("tmpAudioOutput");
        // 释放转码后的音频
        await ffmpegInstance.deleteFile("tmpAudioOutput");
        const audioBlob = URL.createObjectURL(new Blob([finalAudioData as unknown as BlobPart], { type: "audio/flac" }));
        audioRef.current!.src = audioBlob;
        // 解码很耗时 再次检查
        if (!isMounted()) return () => {
            clearInterval(looper);
            URL.revokeObjectURL(audioBlob);
            imageUrl && URL.revokeObjectURL(imageUrl);
            ffmpegInstance.deleteFile("tmpAudioOutput").catch(() => { });
            ffmpegInstance.deleteFile("tmpAudioInput").catch(() => { });
        }
        audioRef.current?.play();
        audioRef.current?.addEventListener("loadedmetadata", onAudioMetadataLoaded);
        audioRef.current?.addEventListener("timeupdate", onAudioTimeUpdate);
        audioRef.current?.addEventListener("ended", onAudioEnded);
        return () => {
            // 释放资源
            clearInterval(looper);
            audioRef.current?.pause();
            audioRef.current?.removeAttribute("src");
            audioRef.current?.load();
            audioRef.current?.removeEventListener("loadedmetadata", onAudioMetadataLoaded);
            audioRef.current?.removeEventListener("timeupdate", onAudioTimeUpdate);
            audioRef.current?.removeEventListener("ended", onAudioEnded);
            audioRef.current = null;
            imageUrl && URL.revokeObjectURL(imageUrl);
            URL.revokeObjectURL(audioBlob);
        }
    }, result => result?.(), []);
    function onSliderChange(event: React.ChangeEvent<HTMLInputElement>) {
        const newValue = parseInt(event.target.value);
        setSliderValue(newValue);
        audioRef.current!.currentTime = newValue;
    }
    return (
        <div className="w-full h-full fixed bg-black/70 left-0 z-10" onClick={() => setVisible(false)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[rgb(var(--mdui-color-surface-container-low))] rounded-xl flex" onClick={(e) => e.stopPropagation()}>
                {/* 左侧 信息显示和控制 */}
                <div className="h-full flex flex-col flex-1 items-center mt-6">
                    {/* 歌名 */}
                    <b className="text-[gray]">{metadata?.title ?? "Loading..."}</b>
                    {/* 歌手 */}
                    <span className="text-[gray]">{metadata?.artist ?? "Loading..."}</span>
                    {/* 专辑 */}
                    <small className="text-[gray] mt-0.5">{metadata?.album ?? "Loading..."}</small>
                    {/* 封面 */}
                    <img ref={imageRef} style={{ rotate: `${rotate}deg` }} src="./audioPlayerNotPicture.png" className="w-45 h-45 mt-2" />
                    {/* 时间显示 */}
                    <div className="flex justify-between w-full mt-1.5">
                        <small className="text-[gray] ml-3">{time2str(currentTime)}</small>
                        <small className="text-[gray] mr-3">{time2str(duration)}</small>
                    </div>
                    {/* 进度条 */}
                    <mdui-slider onPointerDown={() => userControllingSlider.current = true} onPointerUp={() => userControllingSlider.current = false} onChange={onSliderChange} max={duration} value={sliderValue} nolabel className="w-11/12 mt-1"></mdui-slider>
                    {/* 控制 */}
                    <div className="flex justify-center items-center gap-2.5">
                        <mdui-tooltip content={paused ? "播放" : "暂停"} placement="left">
                            <mdui-button-icon icon={paused ? "play_arrow" : "pause"} onClick={() => { setPaused(!paused); audioRef.current?.paused ? audioRef.current?.play() : audioRef.current?.pause() }} disabled={duration === 0}></mdui-button-icon>
                        </mdui-tooltip>
                        <mdui-tooltip content="歌词滚动" placement="right">
                            <mdui-button-icon selected={enableLyricAutoScroll} icon="sync_alt" disabled={duration === 0 || lyric.length === 0} onClick={()=>setEnableLyricAutoScroll(prev=>!prev)}></mdui-button-icon>
                        </mdui-tooltip>
                    </div>
                </div>
                {/* 右侧 歌词(如果有) */}
                <div className="h-full flex-1">
                    <AutoScrollLyric audioRef={audioRef} currentTime={currentTime * 1000/* 转换为ms 和歌词数组对应*/} lyric={lyric} enableLyricAutoScroll={enableLyricAutoScroll} setEnableLyricAutoScroll={setEnableLyricAutoScroll}/>
                </div>
            </div>
        </div>
    )
}
