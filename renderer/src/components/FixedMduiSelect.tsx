import { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
export type SelectItem = { value: string, text: string ,desc?:string}
interface FixedMduiSelectProps {
    label?: string
    className?: string
    menuItemClassName?: string
    slot?: string
    items: SelectItem[]
    value: string
    onChange:(value:string)=>void|Promise<void>|boolean|Promise<boolean>
};
export default function FixedMduiSelect({ slot, className, label, items, value ,menuItemClassName,onChange}: FixedMduiSelectProps) {
    const [currentValue, setCurrentValue]=useState(value);
    const [currentName, setCurrentName]=useState(value);
    useEffect(()=>{
        const item=items.find(item=>item.value===currentValue);
        if(item){
            setCurrentName(item.text);
        }
    },[currentValue])
    async function onItemClick(item: SelectItem) {
        // 可能返回void
        if (await onChange(item.value)===false) return
        setCurrentValue(item.value);
    }
    return (
        <div slot={slot}>
            <mdui-dropdown className="w-full">
                <mdui-text-field slot="trigger" className={twMerge("fixedMduiSelect w-full", className)} label={label} readonly value={currentName} />
                <mdui-menu>
                    {
                        items.map(item => <mdui-menu-item onClick={()=>onItemClick(item)} className={twMerge(menuItemClassName)} icon={currentValue===item.value?"checked":""} key={item.value} value={item.value} end-text={item.desc}>
                            <span className="fixed z-10 pointer-events-none select-none">{item.text}</span>
                        </mdui-menu-item>)
                    }
                </mdui-menu>
            </mdui-dropdown>
        </div>
    )
};
