import { useEffect, useRef, type EffectCallback } from "react";

export default function useUpdateEffect(effect:EffectCallback, deps: any[]) {
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const result=effect();
    return result;
  }, deps);
}