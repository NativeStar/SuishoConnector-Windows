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
    return (
        <mdui-list-item className={twMerge("", className)} headline={title} description={desc} icon={icon}>
            <FixedMduiSelect slot="end-icon" menuItemTextClassName="-mt-0.5" value={value} items={items} menuItemClassName="w-52" onChange={onChange}/>
        </mdui-list-item>
    )
};
