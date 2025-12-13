import { PhotoSlider } from "react-photo-view";
interface PhotoViewProps {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
    imageUrl: string;
}
export default function PhotoView({ visible, setVisible, imageUrl }: PhotoViewProps) {
    return (
        <PhotoSlider
            maskOpacity={0.8}
            images={[{ key: imageUrl || "preview", src: imageUrl }]}
            visible={visible}
            onClose={() => setVisible(false)}
            bannerVisible
            loop={false}
            portalContainer={document.body}
        />
    )
}
