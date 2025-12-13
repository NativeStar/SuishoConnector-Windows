import { PhotoSlider } from "react-photo-view";
interface PhotoViewProps {
    visible: boolean;
    setVisible: React.Dispatch<React.SetStateAction<boolean>>;
    imageUrl: string;
}
export default function PhotoView({ visible, setVisible, imageUrl }: PhotoViewProps) {
    return (
        <PhotoSlider
            className="z-99999999 w-full h-full"
            maskOpacity={1}
            images={[{ key: "onlyOnce", src: imageUrl }]}
            visible={visible}
            onClose={() => setVisible(false)}
            bannerVisible={false}
            loop={false}
        />
    )
}