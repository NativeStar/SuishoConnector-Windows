import { twMerge } from "tailwind-merge";

interface SettingItemCommonProps {
    icon:string
    title:string
    desc?:string
    className?:string
    onClick?:()=>void
}
export default function SettingItemCommon({title,desc,className,icon,onClick}:SettingItemCommonProps) {
    return (
        <mdui-list-item className={twMerge(className)} headline={title} description={desc} icon={icon} onClick={onClick}/>
    )
}