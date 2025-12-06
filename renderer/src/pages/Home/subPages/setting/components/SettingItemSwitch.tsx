import { useRef, useState } from "react"
import { twMerge } from "tailwind-merge"

interface SettingItemSelectProps {
    icon: string
    title: string
    desc?: string
    className?: string
    onChange: (value: boolean) => void | boolean
    value: boolean
}
export default function SettingItemSwitch({ icon, title, desc, className, onChange, value }: SettingItemSelectProps) {
    const [switchChecked, setSwitchChecked] = useState(value);
    const switchRef = useRef<HTMLInputElement>(null);
    function internalOnChange(e: React.FormEvent<HTMLInputElement>) {
        e.stopPropagation();
        if (onChange((e.target as HTMLInputElement).checked) === false) {
            e.preventDefault();
            (e.target as HTMLInputElement).checked = switchChecked;
            return
        };
        setSwitchChecked((e.target as HTMLInputElement).checked)
    }
    return (
        <mdui-list-item onClick={()=>switchRef.current?.click()} className={twMerge(className)} headline={title} description={desc} icon={icon}>
            <mdui-switch ref={switchRef} checked-icon="" slot="end-icon" checked={switchChecked} onChange={internalOnChange} onClick={e=>e.stopPropagation()}/>
        </mdui-list-item>
    )
}