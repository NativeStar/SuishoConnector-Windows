import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { twMerge } from "tailwind-merge";
export type SelectItem = { value: string, text: string, desc?: string }
interface FixedMduiSelectProps {
    label?: string
    className?: string
    menuItemClassName?: string
    menuItemTextClassName?: string
    menuClassName?: string
    slot?: string
    items: SelectItem[]
    value: string
    icon?: string
    variant?: "filled" | "outlined"
    onChange: (value: string) => void | Promise<void> | boolean | Promise<boolean>
};
export interface FixedMduiSelectRef {
    setValue(value: string): void
}
// 替代mdui-select
// 自带的问题太多了 服
const FixedMduiSelect = forwardRef<FixedMduiSelectRef, FixedMduiSelectProps>(({ items, onChange, value, className, icon, label, menuClassName, menuItemClassName, menuItemTextClassName, slot, variant }, ref) => {
    useImperativeHandle(ref, () => ({
        setValue(value) {
            setCurrentValue(value);
        },
    }));
    const [currentValue, setCurrentValue] = useState(value);
    const [currentName, setCurrentName] = useState(value);
    useEffect(() => {
        const item = items.find(item => item.value === currentValue);
        if (item) {
            setCurrentName(item.text);
        }
    }, [currentValue])
    async function onItemClick(item: SelectItem) {
        // 可能返回void
        if (item.value === currentValue || await onChange(item.value) === false) return
        setCurrentValue(item.value);
    }
    return (
        <div slot={slot}>
            <mdui-dropdown>
                <mdui-text-field slot="trigger" variant={variant} icon={icon} className={twMerge("fixedMduiSelect cursor-pointer", className)} label={label} readonly value={currentName} />
                <mdui-menu className={menuClassName}>
                    {
                        items.map(item => <mdui-menu-item onClick={() => onItemClick(item)} className={twMerge(menuClassName, menuItemClassName)} icon={currentValue === item.value ? "checked" : ""} key={item.value} value={item.value} end-text={item.desc}>
                            <span className={twMerge("fixed z-10 pointer-events-none select-none", menuItemTextClassName)}>{item.text}</span>
                        </mdui-menu-item>)
                    }
                </mdui-menu>
            </mdui-dropdown>
        </div>
    )
});
export default FixedMduiSelect;