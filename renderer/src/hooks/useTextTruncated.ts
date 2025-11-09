import { useState, useRef, useEffect } from "react";

function useTextTruncated(offset: number) {
    const [isTruncated, setIsTruncated] = useState(false);
    const [defaultIsOverflow, setDefaultIsOverflow] = useState<boolean|null>(null);
    const textRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (textRef.current) {
            const element = textRef.current;
            const isOverflow = element.clientWidth < element.scrollWidth+offset;
            setIsTruncated(isOverflow);
            if (defaultIsOverflow===null) {
                setDefaultIsOverflow(isOverflow);
            }
        }
    }, []);
    return [defaultIsOverflow,isTruncated, textRef] as const;
}
export default useTextTruncated;
