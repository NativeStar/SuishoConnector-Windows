import { useState } from "react"
import { twMerge } from "tailwind-merge"
import type { Select } from 'mdui/components/select';
interface SettingItemSelectProps {
    icon: string
    title: string
    desc?: string
    className?: string
    onChange: (value:string) => void|boolean
    items: { value: string, text: string }[];
    value: string
}
export default function SettingItemSelect({ icon, title, desc, className, onChange, items, value }: SettingItemSelectProps) {
    const [selectValue, setSelectValue] = useState(value);
    function internalOnChange(e:React.FormEvent<HTMLSelectElement>){
        const targetValue=(e.target as Select).value as string
        // 可能返回void
        if (targetValue===""||onChange(targetValue)===false) {
            e.preventDefault();
            (e.target as Select).value=selectValue;
            return
        }
        setSelectValue(targetValue)
    }
    return (
        <mdui-list-item className={twMerge("", className)} headline={title} description={desc} icon={icon}>
            <mdui-select className="fixMduiSelect" slot="end-icon" value={selectValue} onChange={internalOnChange}>
                {
                    items.map(item => <mdui-menu-item key={item.value} value={item.value}>
                        <span className="fixed z-10 pointer-events-none select-none">{item.text}</span>
                    </mdui-menu-item>)
                }
            </mdui-select>
        </mdui-list-item>
    )
};
