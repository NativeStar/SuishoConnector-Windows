interface ModalLayoutProps {
    onLayoutClick:()=>void,
    children:React.ReactNode
}
export default function ModalLayout({onLayoutClick,children}:ModalLayoutProps) {
    return (
        <div className="w-full h-full fixed bg-black/50 left-0 z-10" onClick={() => onLayoutClick()}>
            {children}
        </div>
    )
}