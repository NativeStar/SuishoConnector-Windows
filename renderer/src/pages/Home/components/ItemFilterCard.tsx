import "mdui/components/text-field"
import "mdui/components/tooltip"
import { useEffect, useRef, useState } from "react"
import { twMerge } from "tailwind-merge"
interface ItemFilterCardProps {
    className?: string,
    setSearchText: React.Dispatch<React.SetStateAction<string>>,
    setShowFilterCard:React.Dispatch<React.SetStateAction<boolean>>,
    extSwitchIcon:string,
    extSwitchText:string,
    extSwitchState:boolean,
    setExtSwitchState:React.Dispatch<React.SetStateAction<boolean>>
}
export default function ItemFilterCard({ className, setSearchText,setShowFilterCard,extSwitchIcon,extSwitchText,extSwitchState,setExtSwitchState}: ItemFilterCardProps) {
    const textFieldRef = useRef<HTMLElement>(null);
    const [searchTextInner, setSearchTextInner]=useState<string>("");
    function onInputFieldKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            console.debug(`Search text:${searchTextInner}`);
            setSearchText(searchTextInner);
        }
    }
    useEffect(() => {
        function onInputClear() {
            setSearchText("");
        }
        textFieldRef.current?.addEventListener("clear", onInputClear);
        // 通过菜单打开的没法autofocus
        setTimeout(() => {
            textFieldRef.current?.focus();
        }, 50);
        return () => {
            textFieldRef.current?.removeEventListener("clear", onInputClear);
            // 清空搜索内容
            setSearchText("");
            // 重置大小写
            setExtSwitchState(false);
        }
    }, []);
    return (
        <mdui-card variant="elevated" className={twMerge("flex items-center fixed w-[48%] h-[11%] mt-[5%] ml-[20%] z-5", className)}>
            <mdui-text-field autofocus value={searchTextInner} onChange={(e)=>setSearchTextInner((e.currentTarget as HTMLInputElement).value)} ref={textFieldRef} label="内容" variant="outlined" clearable className="ml-1.5 w-8/12 h-10/12" onKeyUp={onInputFieldKeyUp} />
            <mdui-tooltip content="搜索(Enter)">
                <mdui-button-icon variant="tonal" icon="search" className="ml-1" onClick={()=>setSearchText(searchTextInner)}/>
            </mdui-tooltip>
            <mdui-tooltip content={extSwitchText}>
                <mdui-button-icon selected={extSwitchState} onClick={()=>setExtSwitchState(state=>!state)} icon={extSwitchIcon} selectable className="ml-1"/>
            </mdui-tooltip>
            <mdui-tooltip content="关闭">
                <mdui-button-icon icon="close" className="ml-1" onClick={()=>setShowFilterCard(false)}/>
            </mdui-tooltip>
        </mdui-card>
    )
}
