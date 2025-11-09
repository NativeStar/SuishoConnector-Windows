interface TransmitPageProps {
    hidden: boolean
}
export default function TransmitPage({ hidden }: TransmitPageProps) {
    return (
        <div style={{ display: hidden ? "none" : "block" }}>

        </div>
    )
}