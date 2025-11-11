import List from "rc-virtual-list";
import TransmitTextInputArea from "./components/TransmitTextInputArea";
import { useEffect, useRef } from "react";
import useDatabase from "~/hooks/useDatabase";
interface TransmitPageProps {
    hidden: boolean
}
export default function TransmitPage({ hidden }: TransmitPageProps) {
    const db = useDatabase();
    const fileInputRef = useRef<HTMLInputElement>(null);
    useEffect(()=>{
        console.log(db.getAllData("transmit").then(value=>{
            console.log(value);
        }));
    },[])
    return (
        <div style={{ display: hidden ? "none" : "block" }}>
            {/* 列表内容 */}
            <List itemKey="id" data={[{id:'1'}, {id:'2'}, {id:'3'}]}>
                {(item, index, prop) => {
                    console.log(item, index, prop);
                    return (
                        <div>
                            <div>{item.id}</div>
                        </div>
                    )
                }}
            </List>
            {/* 输入和菜单区 */}
            <div className="fixed w-full h-[8%] bottom-0 left-[9%] border-r-[5px] bg-[#f8edf9]">
                {/* 文件上传input */}
                <input type="file" hidden ref={fileInputRef}/>
                <TransmitTextInputArea/>
                <mdui-dropdown>
                    {/* 菜单按钮 */}
                    <mdui-button slot="trigger" variant="text" className="ml-2.5">
                        <img src="./open_in_new.svg" />
                    </mdui-button>
                    <mdui-menu>
                        <mdui-menu-item>清空消息</mdui-menu-item>
                        <mdui-menu-item>搜索</mdui-menu-item>
                        <mdui-menu-item onClick={()=>fileInputRef.current?.click()}>上传文件</mdui-menu-item>
                        <mdui-menu-item>打开文件夹</mdui-menu-item>
                    </mdui-menu>
                </mdui-dropdown>
            </div>
        </div>
    )
}