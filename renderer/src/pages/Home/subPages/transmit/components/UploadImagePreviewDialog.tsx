import { useEffect, useState } from "react";
import { parseFileSize } from "~/utils";

interface UploadImagePreviewDialogProps {
    imageBlob: Blob
    setImageBlob: React.Dispatch<React.SetStateAction<Blob | null>>
    uploadFunction: () => void
}
export default function UploadImagePreviewDialog({ imageBlob, setImageBlob, uploadFunction }: UploadImagePreviewDialogProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
    useEffect(() => {
        console.debug("Show image preview dialog");
        const url = URL.createObjectURL(imageBlob)
        setImageUrl(url);
        return () => {
            URL.revokeObjectURL(url);
            console.debug("Revoked image preview url");
        }
    }, []);
    return (
        <div className="w-full h-full fixed bg-black/50 left-0 z-10" onClick={() => setImageBlob(null)}>
            <div className="w-10/12 h-8/12 fixed top-29 left-18 z-20 bg-[rgb(var(--mdui-color-surface-container-highest))] rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                {imageUrl && <img onLoad={(event) => {
                    setImageSize({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight });
                }} src={imageUrl} className="w-10/12 h-10/12 object-cover mt-3 self-center" />}
                <div className="flex mt-2 justify-end mr-4 gap-1">
                    <span className="text-[gray] mt-2 ml-13 flex-1">图片大小({imageSize.w}x{imageSize.h}):{parseFileSize(imageBlob.size)}</span>
                    <mdui-button variant="text" onClick={() => setImageBlob(null)}>取消</mdui-button>
                    <mdui-button variant="text" onClick={() => {
                        uploadFunction();
                    }}>发送</mdui-button>
                </div>
            </div>
        </div>
    )
}