import { useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge"
import FixedMduiSelect, { type FixedMduiSelectRef } from "~/components/FixedMduiSelect";
interface SettingItemSelectProps {
    icon: string
    title: string
    desc?: string
    className?: string
    onChange?: (value:string) => void|Promise<void>|boolean|Promise<boolean>
    items: { value: string, text: string }[];
    configs: { [key: string]: string | number | boolean; }
    configKey: string,
    setConfig: (key: string, value: string | number | boolean) => void
}
export default function SettingItemSelect({ icon, title, desc, className, onChange, items, configKey,configs,setConfig}: SettingItemSelectProps) {
    const selectRef=useRef<FixedMduiSelectRef>(null)
    useEffect(()=>{
        selectRef.current?.setValue(configs[configKey] as string)
    },[configs])
    async function internalOnChange(value: string) {
        if(await onChange?.(value)===false){
            console.info(`Setting "${configKey}" select change canceled`);
            return false
        }
        //事件没被取消 执行更改
        setConfig(configKey, value);
        console.info(`Setting "${configKey}" select change to "${value}"`);
        return true
    }
    return (
        <mdui-list-item className={twMerge("", className)} headline={title} description={desc} icon={icon}>
            <FixedMduiSelect ref={selectRef} slot="end-icon" menuItemTextClassName="-mt-0.5" value={""} items={items} menuItemClassName="w-52" onChange={internalOnChange}/>
        </mdui-list-item>
    )
};
