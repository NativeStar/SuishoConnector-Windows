import { useState, useRef, useEffect } from "react";

function useTextTruncated(offset: number) {
    const [defaultIsOverflow, setDefaultIsOverflow] = useState<boolean | null>(null);
    const textRef = useRef<HTMLDivElement>(null);
    function calc() {
        if (textRef.current) {
            const element = textRef.current;
            const isOverflow = element.clientWidth < element.scrollWidth + offset;
            if (defaultIsOverflow === null) {
                setDefaultIsOverflow(isOverflow);
            }
        }
    }
    useEffect(() => {
        if (textRef.current) {
            // 不延迟的话读取scrollWidth之类属性会把Virtuoso滚动干崩 天知道原因
            requestAnimationFrame(() => {
                if (textRef?.current?.clientWidth === 0 || textRef?.current?.scrollWidth === 0) {
                    const observer = new ResizeObserver((entries) => {
                        if (entries[0].contentRect.width !== 0) {
                            observer.disconnect();
                            calc();
                        }
                    });
                    observer.observe(textRef.current);
                    return () => {
                        observer.disconnect();
                    }
                } else {
                    calc();
                }
            });
        }
    }, []);
    return [defaultIsOverflow, textRef] as const;
}
export default useTextTruncated;
