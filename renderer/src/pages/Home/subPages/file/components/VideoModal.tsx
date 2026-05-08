interface VideoModalProps{
    src:string;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
export default function VideoModal({setVisible,src}:VideoModalProps){
    return (
        <div className="w-full h-full fixed bg-black/70 left-0 z-10" onClick={() => setVisible(false)}>
            <video src={src} controlsList="nodownload" autoFocus={false} onClick={(e)=>e.stopPropagation()} controls disablePictureInPicture className="fixed top-26 left-15 w-10/12 h-8/12" autoPlay></video>
        </div>
    )
}