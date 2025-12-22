import { useRef, useState } from "react";
import "mdui/components/slider"
import { ensureFfmpegLoaded, time2str } from "~/utils";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { parseBuffer } from "music-metadata"
import { useAsyncEffect } from "use-async-effect"
import AutoScrollLyric, { type LyricItemType } from "./AutoScrollLyric";
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
    const imageRef = useRef<HTMLImageElement | null>(null);
    // 防止进度条拖动时闪烁
    const userControllingSlider = useRef<boolean>(false);
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
        const fileData = await (await fetch(src)).arrayBuffer();
        //解码 使用无损flac
        if (!isMounted()) return
        //元数据
        const audioMetadata = await parseBuffer(new Uint8Array(fileData));
        setMetadata({
            title: audioMetadata.common.title ?? "未知曲名",
            artist: audioMetadata.common.artist ?? "未知歌手",
            album: audioMetadata.common.album ?? "未知专辑",
        });
        setLyric(audioMetadata.common.lyrics?.[0].syncText??[]);
        if (audioMetadata.common.picture && audioMetadata.common.picture[0]) {
            const imageData = audioMetadata.common.picture[0].data;
            let base64String = "";
            for (let i = 0; i < imageData.length; i++) {
                base64String += String.fromCharCode(imageData[i]);
            }
            imageRef.current!.src = `data:${audioMetadata.common.picture[0].format};base64,${btoa(base64String)}`;
            clearInterval(looper);
            setRotate(()=>0);
        }
        await ffmpegInstance.writeFile("tmpAudioInput", new Uint8Array(fileData));
        await ffmpegInstance.exec(["-i", "tmpAudioInput", "-f", "flac", "tmpAudioOutput"]);
        // 释放原始输入 它的任务结束了
        await ffmpegInstance.deleteFile("tmpAudioInput");
        const finalAudioData = await ffmpegInstance.readFile("tmpAudioOutput");
        const flacArrayBuffer = new Uint8Array(finalAudioData as Uint8Array);
        const audioBlob = URL.createObjectURL(new Blob([flacArrayBuffer], { type: "audio/flac" }));
        audioRef.current!.src = audioBlob;
        // 解码很耗时 再次检查
        if (!isMounted()) return
        audioRef.current?.play();
        audioRef.current?.addEventListener("loadedmetadata", () => {
            setDuration(() => audioRef.current?.duration ?? 0)
        });
        audioRef.current?.addEventListener("timeupdate", () => {
            setCurrentTime(() => audioRef.current?.currentTime ?? 0)
            if (!userControllingSlider.current) {
                setSliderValue(() => audioRef.current?.currentTime ?? 0)
            }
        });
        audioRef.current?.addEventListener("ended", () => {
            setPaused(true);
            audioRef.current!.pause();
            audioRef.current!.currentTime = 0;
            setSliderValue(() => 0);
        });
        return () => {
            // 释放资源
            clearInterval(looper);
            audioRef.current?.pause();
            audioRef.current = null;
            URL.revokeObjectURL(audioBlob);
            ffmpegInstance.deleteFile("tmpAudioOutput");
        }
    }, result => result?.(), []);
    function onSliderChange(event: React.ChangeEvent<HTMLInputElement>) {
        const newValue = parseInt(event.target.value);
        setSliderValue(newValue);
        audioRef.current?.fastSeek
        audioRef.current!.currentTime = newValue;
    }
    return (
        <div className="w-full h-full fixed bg-black/70 left-0 z-10" onClick={() => setVisible(false)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[#fdf7fe] rounded-xl flex" onClick={(e) => e.stopPropagation()}>
                {/* 左侧 信息显示和控制 */}
                <div className="h-full flex flex-col flex-1 items-center mt-6">
                    {/* 歌名 */}
                    <b className="text-[gray]">{metadata?.title ?? "Loading..."}</b>
                    {/* 歌手 */}
                    <span className="text-[gray]">{metadata?.artist ?? "Loading..."}</span>
                    {/* 专辑 */}
                    <small className="text-[gray] mt-0.5">{metadata?.album ?? "Loading..."}</small>
                    {/* 封面 */}
                    <img ref={imageRef} style={{rotate:`${rotate}deg`}} src="./audioPlayerNotPicture.png" className="w-45 h-45 mt-2" />
                    {/* 时间显示 */}
                    <div className="flex justify-between w-full mt-1.5">
                        <small className="text-[gray] ml-3">{time2str(currentTime)}</small>
                        <small className="text-[gray] mr-3">{time2str(duration)}</small>
                    </div>
                    {/* 进度条 */}
                    <mdui-slider onMouseDown={() => userControllingSlider.current = true} onMouseUp={() => userControllingSlider.current = false} onChange={onSliderChange} max={duration} value={sliderValue} nolabel className="w-11/12 mt-1"></mdui-slider>
                    {/* 控制 */}
                    <div className="flex justify-center items-center">
                        <mdui-button-icon icon={paused ? "play_arrow" : "pause"} onClick={() => { setPaused(!paused); audioRef.current?.paused ? audioRef.current?.play() : audioRef.current?.pause() }} disabled={duration === 0}></mdui-button-icon>
                    </div>
                </div>
                {/* 右侧 歌词(如果有) */}
                <div className="h-full flex-1">
                    <AutoScrollLyric audioRef={audioRef} currentTime={currentTime*1000/* 转换为ms 和歌词数组对应*/} lyric={lyric} />
                </div>
            </div>
        </div>
    )
}
