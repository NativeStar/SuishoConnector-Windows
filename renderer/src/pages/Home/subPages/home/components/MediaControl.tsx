import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import type { MediaSessionMetadata } from "~/types/ipc";
import { time2str } from "~/utils";
type MduiSliderElement = HTMLElement & { value: number };
interface MediaControlProps {
    className?: string
}
// 旋转动画角度
const rotateList = [60, 120, 180, 240, 300, 360];
export default function MediaControl({className}:MediaControlProps) {
    const ipc = useMainWindowIpc();
    const [playing, setPlaying] = useState(false);
    const [controllable, setControllable] = useState(false);
    const [duration, setDuration] = useState(0);
    const [rotate, setRotate] = useState<number>(0);
    const userControllingSlider = useRef<boolean>(false);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [mediaSessionMetadata, setMediaSessionMetadata] = useState<MediaSessionMetadata>({
        title: "暂无播放",
        artist: "-",
        album: "-",
        image: "null",
        duration: 0
    });
    let durationLooper: number = -1;
    function onSliderChange(event: React.ChangeEvent<MduiSliderElement>){
        console.log(event.target.value)
        ipc.appendMediaSessionControl("seek",event.target.value*1000)
    }
    useEffect(() => {
        const updateMediaSessionMetadataCleanup = ipc.on("updateMediaSessionMetadata", data => {
            if (data.image === "keep") {
                setMediaSessionMetadata(prev => ({
                    ...prev,
                    image: prev.image
                }));
                return
            }
            setRotate(0);
            setMediaSessionMetadata(data);
        });
        const updateMediaSessionPlaybackStateCleanup = ipc.on("updateMediaSessionPlaybackState", data => {
            if (!data.hasSession) {
                setDuration(0);
                setPlaying(false);
                setControllable(false);
                setMediaSessionMetadata({
                    title: "暂无播放",
                    artist: "-",
                    album: "-",
                    image: "null",
                    duration: 0
                })
                return
            }
            setPlaying(data.playing);
            setControllable(true);
            setDuration(data.position);
        });
        let aniIndex = 0;
        const animationLooper= setInterval(() => {
            if (!imageRef.current?.src.startsWith("data:image")) {
                if (aniIndex >= rotateList.length) {
                    aniIndex = 0;
                }
                setRotate(rotateList[aniIndex]);
                aniIndex++;
            } else {
                aniIndex = 0;
                setRotate(0);
            }
        }, 200);
        return () => {
            clearInterval(animationLooper);
            updateMediaSessionMetadataCleanup();
            updateMediaSessionPlaybackStateCleanup();
        }
    }, []);
    useEffect(() => {
        if (playing) {
            durationLooper = setInterval(() => {
                if (!userControllingSlider.current) setDuration(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(durationLooper);
        }
        return () => {
            clearInterval(durationLooper);
        }
    }, [playing, mediaSessionMetadata])
    return (
        <mdui-card className={twMerge("fixed h-[35%] flex flex-col max-w-[40%] min-w-[40%]",className)}>
            <div className="flex">
                {/* 封面 */}
                <img ref={imageRef} style={{ rotate: `${rotate}deg` }} src={mediaSessionMetadata.image === "null" ? "./audioPlayerNotPicture.png" : mediaSessionMetadata.image} className="w-24 h-24 mt-2 ml-2" />
                {/* 元数据 */}
                <div className="flex flex-col ml-3 mt-5 w-[67%]">
                    <b className="truncate text-nowrap text-[gray]">{mediaSessionMetadata.title}</b>
                    <span className="truncate text-nowrap text-[gray]">{mediaSessionMetadata.artist}</span>
                    <small className="truncate text-nowrap mt-0.5 text-[gray]">{mediaSessionMetadata.album}</small>
                </div>
            </div>
            {/* 时间显示 */}
            <div className="flex justify-between w-11/12 ml-3.5 mt-3">
                <small className="text-[gray]">{time2str(duration)}</small>
                <small className="text-[gray]">{time2str(mediaSessionMetadata.duration)}</small>
            </div>
            <mdui-slider onPointerDown={() => userControllingSlider.current = true} onPointerUp={() => userControllingSlider.current = false} onChange={onSliderChange} nolabel value={duration} disabled={!controllable} max={mediaSessionMetadata.duration === 0 ? 1 : mediaSessionMetadata.duration} className="w-11/12 ml-3.5 mt-3" />
            {/* 控制按钮 */}
            <div className="flex justify-between w-11/12 ml-3.5 mt-2.5">
                <mdui-button-icon disabled={!controllable} icon="skip_previous" onClick={() => ipc.appendMediaSessionControl("previous")}></mdui-button-icon>
                <mdui-button-icon disabled={!controllable} icon={playing ? "pause" : "play_arrow"} onClick={() => ipc.appendMediaSessionControl("changePlayState")}></mdui-button-icon>
                <mdui-button-icon disabled={!controllable} icon="skip_next" onClick={() => ipc.appendMediaSessionControl("next")}></mdui-button-icon>
            </div>
        </mdui-card>
    )
}