import { useRef, useState } from "react"

interface CommonMduiListItemSwitchProp {
    title: string
    desc: string
    checked: boolean
    onChange: (state: boolean) => void
    icon: string
}
export default function CommonMduiListItemSwitch({ title, desc, onChange, checked, icon }: CommonMduiListItemSwitchProp) {
    const [switchChecked, setSwitchChecked] = useState(checked);
    const switchRef = useRef<HTMLInputElement>(null);
    return (
        <mdui-list-item onClick={() => switchRef.current?.click()} headline={title} description={desc} icon={icon}>
            <mdui-switch ref={switchRef} checked={switchChecked} onChange={() => {
                setSwitchChecked(!switchChecked)
                onChange(!switchChecked);
            }
            } checked-icon="" slot="end-icon" onClick={e => e.stopPropagation()}/>
        </mdui-list-item>
    )
}