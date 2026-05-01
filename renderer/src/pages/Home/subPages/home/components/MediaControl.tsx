import { snackbar } from "mdui";
import { useCallback, useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import useMainWindowIpc from "~/hooks/ipc/useMainWindowIpc"
import type { MediaSessionMetadata } from "~/types/ipc";
import { time2str } from "~/utils";
type MduiSliderElement = HTMLElement & { value: number };
interface MediaControlProps {
    className?: string
}
interface MediaInfoTextTipProps {
    typeText: string
    text: string
    children: React.ReactNode
    hasMediaSession: boolean
}
// 旋转动画角度
const rotateList = [60, 120, 180, 240, 300, 360];
function MediaInfoTextTip({ typeText, text, children, hasMediaSession }: MediaInfoTextTipProps) {
    //没有播放媒体 不能复制东西
    if (!hasMediaSession) {
        return children;
    }
    const copyText = useCallback(() => {
        navigator.clipboard.writeText(text);
        snackbar({ message: `已复制${typeText}文本`, autoCloseDelay: 750 })
    }, [text])
    return (
        <mdui-tooltip placement="left">
            <span className="whitespace-normal wrap-anywhere break-all" slot="content">{typeText}:{text}
                <br />
                点击以复制
            </span>
            <div onClick={copyText}>
                {children}
            </div>
        </mdui-tooltip>
    )
}
export default function MediaControl({ className }: MediaControlProps) {
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
    function onSliderChange(event: React.ChangeEvent<MduiSliderElement>) {
        ipc.appendMediaSessionControl("seek", event.target.value * 1000);
        console.debug(`Seek phone media to:${event.target.value * 1000}`);
    }
    useEffect(() => {
        const updateMediaSessionMetadataCleanup = ipc.on("updateMediaSessionMetadata", data => {
            if (data.image === "keep") {
                setMediaSessionMetadata(prev => ({
                    ...data,
                    image: prev.image
                }));
                console.debug("update media session with keep image");
                return
            }
            setRotate(0);
            setMediaSessionMetadata(data);
            console.debug(`Update media session:${mediaSessionMetadata.title}:${mediaSessionMetadata.album}:${mediaSessionMetadata.artist}`);
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
                });
                console.debug("Update not media session");
                return
            }
            setPlaying(data.playing);
            setControllable(true);
            setDuration(data.position);
            console.debug(`Update media session playback state:${JSON.stringify(data)}`);
        });
        let aniIndex = 0;
        const animationLooper = setInterval(() => {
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
    // 更新进度条
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
        <mdui-card className={twMerge("fixed h-[35%] flex flex-col max-w-[40%] min-w-[40%]", className)}>
            <div className="flex">
                {/* 封面 */}
                <img ref={imageRef} style={{ rotate: `${rotate}deg` }} src={mediaSessionMetadata.image === "null" ? "./audioPlayerNotPicture.png" : mediaSessionMetadata.image} className="w-24 h-24 mt-2 ml-2" />
                {/* 元数据 */}
                <div className="flex flex-col ml-3 mt-5 w-[67%]">
                    <MediaInfoTextTip typeText="标题" text={mediaSessionMetadata.title} hasMediaSession={controllable}>
                        <b className="truncate text-nowrap text-[gray] hover:text-red-300">{mediaSessionMetadata.title}</b>
                    </MediaInfoTextTip>
                    <MediaInfoTextTip typeText="艺术家" text={mediaSessionMetadata.artist} hasMediaSession={controllable}>
                        <small className="truncate text-nowrap text-[gray] hover:text-red-300">{mediaSessionMetadata.artist}</small>
                    </MediaInfoTextTip>
                    <MediaInfoTextTip typeText="专辑" text={mediaSessionMetadata.album} hasMediaSession={controllable}>
                        <small className="truncate text-nowrap text-[gray] hover:text-red-300">{mediaSessionMetadata.album}</small>
                    </MediaInfoTextTip>
                </div>
            </div>
            {/* 时间显示 */}
            <div className="flex justify-between w-11/12 ml-3.5 mt-3">
                <small className="text-[gray]">{time2str(duration)}</small>
                <small className="text-[gray]">{time2str(mediaSessionMetadata.duration)}</small>
            </div>
            <mdui-slider key={mediaSessionMetadata.duration} onPointerDown={() => userControllingSlider.current = true} onPointerUp={() => userControllingSlider.current = false} onChange={onSliderChange} nolabel value={duration} disabled={!controllable} max={mediaSessionMetadata.duration === 0 ? 1 : mediaSessionMetadata.duration} className="w-11/12 ml-3.5 mt-3" />
            {/* 控制按钮 */}
            <div className="flex justify-between w-11/12 ml-3.5 mt-2.5">
                <mdui-button-icon disabled={!controllable} icon="skip_previous" onClick={() => ipc.appendMediaSessionControl("previous")}></mdui-button-icon>
                <mdui-button-icon disabled={!controllable} icon={playing ? "pause" : "play_arrow"} onClick={() => ipc.appendMediaSessionControl("changePlayState")}></mdui-button-icon>
                <mdui-button-icon disabled={!controllable} icon="skip_next" onClick={() => ipc.appendMediaSessionControl("next")}></mdui-button-icon>
            </div>
        </mdui-card>
    )
}