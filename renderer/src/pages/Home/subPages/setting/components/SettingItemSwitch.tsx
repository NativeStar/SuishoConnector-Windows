import { useEffect, useRef, useState } from "react"
import { twMerge } from "tailwind-merge"

interface SettingItemSelectProps {
    icon: string
    title: string
    desc?: string
    className?: string
    onChange?: (value: boolean) => void | boolean
    configs: { [key: string]: string | number | boolean; }
    configKey: string,
    setConfig: (key: string, value: string | number | boolean) => void
}
export default function SettingItemSwitch({ icon, title, desc, className, onChange, configKey,configs ,setConfig}: SettingItemSelectProps) {
    const [switchChecked, setSwitchChecked] = useState(false);
    useEffect(()=>{
        setSwitchChecked(configs[configKey] as boolean)
    },[configs])
    const switchRef = useRef<HTMLInputElement>(null);
    function internalOnChange(e: React.FormEvent<HTMLInputElement>) {
        e.stopPropagation();
        if (onChange?.((e.target as HTMLInputElement).checked) === false) {
            e.preventDefault();
            (e.target as HTMLInputElement).checked = switchChecked;
            return
        };
        setSwitchChecked((e.target as HTMLInputElement).checked);
        // 此时state还没变更
        setConfig(configKey, !switchChecked);
    }
    return (
        <mdui-list-item onClick={()=>switchRef.current?.click()} className={twMerge(className)} headline={title} description={desc} icon={icon}>
            <mdui-switch ref={switchRef} checked-icon="" slot="end-icon" checked={switchChecked} onChange={internalOnChange} onClick={e=>e.stopPropagation()}/>
        </mdui-list-item>
    )
}