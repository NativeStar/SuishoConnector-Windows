import { useEffect, useRef, useState } from "react"

export type LyricItemType = { text: string, timestamp?: number }
interface AutoScrollLyricProps {
    lyric: { text: string, timestamp?: number }[],
    currentTime: number
    audioRef: React.RefObject<HTMLAudioElement | null>
    enableLyricAutoScroll: boolean
    setEnableLyricAutoScroll: React.Dispatch<React.SetStateAction<boolean>>
}
interface LyricItemProps {
    text: string
    timestamp: number
    isCurrentLyric: boolean
    enableLyricAutoScroll: boolean
    audioRef: React.RefObject<HTMLAudioElement | null>
}
function LyricItem({ text, timestamp, isCurrentLyric, audioRef, enableLyricAutoScroll }: LyricItemProps) {
    const textRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (isCurrentLyric && enableLyricAutoScroll) {
            textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        }
    }, [isCurrentLyric, enableLyricAutoScroll]);
    return (
        <div
            ref={textRef}
            className="lyricItem w-full text-center overflow-clip hover:bg-gray-100"
            style={{ color: isCurrentLyric ? "red" : "gray" }}
            onClick={() => {
                if (audioRef.current) {
                    audioRef.current.currentTime = timestamp / 1000;
                }
            }}>
            {text}
        </div>
    )
}
export default function AutoScrollLyric({ currentTime, lyric, audioRef, enableLyricAutoScroll, setEnableLyricAutoScroll }: AutoScrollLyricProps) {
    const [currentLyricTimestamp, setCurrentLyricTimestamp] = useState(0);
    useEffect(() => {
        if (lyric.length > 0) {
            const currentLyric = lyric.find((item, index) => {
                return currentTime >= (item.timestamp ?? -1) && (lyric[index + 1]?.timestamp ?? Infinity) > currentTime;
            });
            if (currentLyric) {
                setCurrentLyricTimestamp(currentLyric.timestamp ?? 0);
            }
        }
    }, [currentTime]);
    return lyric.length === 0 ?
        (
            <div className="w-full text-[gray] text-center mt-[56%]">
                未找到内嵌歌词
            </div>
        )
        :
        (
            <div className="noScrollBar flex flex-col gap-3 overflow-y-scroll h-full items-center"
                onWheel={() => setEnableLyricAutoScroll(false)}>
                {lyric.map((item, index) => (
                    <LyricItem audioRef={audioRef} isCurrentLyric={item.timestamp === currentLyricTimestamp} text={item.text} timestamp={item.timestamp ?? -1} key={item.timestamp ?? index} enableLyricAutoScroll={enableLyricAutoScroll} />
                ))}
            </div>
        )
}