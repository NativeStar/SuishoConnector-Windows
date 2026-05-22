import { useCallback, useEffect, useRef, useState } from "react"
type MduiSliderElement = HTMLElement & {
    value: number;
    labelFormatter: (value: number) => string;
};
interface SettingItemSliderProps {
    icon: string
    title: string
    desc?: string
    className?: string
    onChange?: (value: number) => void | boolean
    configs: { [key: string]: string | number | boolean; }
    configKey: string,
    setConfig: (key: string, value: string | number | boolean) => void
    disabled?: boolean,
    min?: number,
    max?: number,
    step?: number,
    labelFormatter?: (value: number) => string
}
export default function SettingItemSlider({ icon, configKey, title, desc, configs, setConfig, className, disabled, onChange, max, min, step ,labelFormatter}: SettingItemSliderProps) {
    const [value, setValue] = useState(0);
    const sliderRef = useRef<MduiSliderElement>(null);
    useEffect(() => {
        if (sliderRef.current&&labelFormatter) {
            sliderRef.current.labelFormatter = labelFormatter
        }
    }, [])
    useEffect(() => {
        setValue(configs[configKey] as number ?? 100);
    }, [configs])
    const internalOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
        const newValue = parseInt(e.target.value);
        if (isNaN(newValue)) {
            return
        }
        if (onChange?.(newValue) === false) {
            e.preventDefault();
        }
        setConfig(configKey, newValue);
        setValue(newValue);
    }, []);
    return (
        <mdui-list-item icon={icon} headline={title} description={desc} className={className}>
            <mdui-slider ref={sliderRef} min={min} max={max} step={step} disabled={disabled} value={value} className="w-55 right-1.5" slot="end-icon" onChange={internalOnChange} />
        </mdui-list-item>
    )
}