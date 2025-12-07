import { useState } from "react"
import { twMerge } from "tailwind-merge"
import FixedMduiSelect from "~/components/FixedMduiSelect";
interface SettingItemSelectProps {
    icon: string
    title: string
    desc?: string
    className?: string
    onChange: (value:string) => void|Promise<void>|boolean|Promise<boolean>
    items: { value: string, text: string }[];
    value: string
}
export default function SettingItemSelect({ icon, title, desc, className, onChange, items, value }: SettingItemSelectProps) {
    // const [selectValue, setSelectValue] = useState(value);
    // function internalOnChange(e:React.FormEvent<HTMLSelectElement>){
    //     const targetValue=(e.target as Select).value as string
    //     // 可能返回void
    //     if (targetValue===""||onChange(targetValue)===false) {
    //         e.preventDefault();
    //         (e.target as Select).value=selectValue;
    //         return
    //     }
    //     setSelectValue(targetValue)
    // }
    return (
        <mdui-list-item className={twMerge("", className)} headline={title} description={desc} icon={icon}>
            <FixedMduiSelect slot="end-icon" value={value} items={items} menuItemClassName="w-52" onChange={onChange}/>
        </mdui-list-item>
    )
};
