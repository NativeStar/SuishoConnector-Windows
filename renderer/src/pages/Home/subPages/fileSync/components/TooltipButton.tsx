interface TooltipButtonProps {
    tooltip: string
    icon: string
    onClick?:()=>void
}
export default function TooltipButton({ icon, tooltip, onClick}: TooltipButtonProps) {
    return (
        <mdui-tooltip placement="bottom" content={tooltip}>
            <mdui-button variant="text" onClick={onClick}>
                <mdui-icon name={icon} />
            </mdui-button>
        </mdui-tooltip>
    )
}