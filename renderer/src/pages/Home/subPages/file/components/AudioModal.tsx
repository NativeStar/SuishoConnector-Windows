import { useEffect, useRef, useState } from "react";
import "mdui/components/slider"
import { ensureFfmpegLoaded } from "~/utils";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { parseBuffer } from "music-metadata"
import { useAsyncEffect } from "use-async-effect"

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
    const audioRef=useRef<HTMLAudioElement>(new Audio());
    useAsyncEffect(async (isMounted) => {
        // ffmpeg
        ffmpegInstance = await ensureFfmpegLoaded();
        //元数据
        const fileData = await (await fetch(src)).arrayBuffer();
        const audioMetadata = await parseBuffer(new Uint8Array(fileData));
        setMetadata({
            title: audioMetadata.common.title ?? "未知曲名",
            artist: audioMetadata.common.artist ?? "未知歌手",
            album: audioMetadata.common.album ?? "未知专辑",
        });
        //解码 使用无损flac
        if (!isMounted()) return
        await ffmpegInstance.writeFile("tmpAudioInput", new Uint8Array(fileData));
        await ffmpegInstance.exec(["-i", "tmpAudioInput", "-f", "flac", "tmpAudioOutput"]);
        await ffmpegInstance.deleteFile("tmpAudioInput");
        const finalAudioData = await ffmpegInstance.readFile("tmpAudioOutput");
        const flacArrayBuffer = new Uint8Array(finalAudioData as Uint8Array);
        const audioBlob = URL.createObjectURL(new Blob([flacArrayBuffer], { type: "audio/flac" }));
        audioRef.current.src = audioBlob;
        console.log(audioRef);
        // 解码很耗时 再次检查
        if (!isMounted()) return
        audioRef.current.play();
        return () => {
            // 释放资源
            audioRef.current.pause();
            URL.revokeObjectURL(audioBlob);
            ffmpegInstance.deleteFile("tmpAudioOutput");
        }
    },result=>result?.(),[]);
    return (
        <div className="w-full h-full fixed bg-black/70 left-0 z-10" onClick={() => setVisible(false)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[#fdf7fe] rounded-xl flex" onClick={(e) => e.stopPropagation()}>
                {/* 左侧 信息显示和控制 */}
                <div className="h-full flex flex-col flex-1 items-center">
                    {/* 歌名 */}
                    <b className="text-[gray]">{metadata?.title}</b>
                    {/* 歌手 */}
                    <span className="text-[gray]">{metadata?.artist}</span>
                    {/* 专辑 */}
                    <small className="text-[gray]">{metadata?.album}</small>
                    {/* 封面 */}
                    <img src="/audioPlayerNotPicture.png" className="w-36 h-36" />
                    {/* TODO 时间显示 */}
                    {/*  */}
                    {/* 进度条 */}
                    <mdui-slider nolabel className="w-11/12"></mdui-slider>
                </div>
                {/* 右侧 歌词(如果有) */}
                <div className="h-full flex-1">
                    lyric placeholder
                </div>
            </div>
        </div>
    )
}
