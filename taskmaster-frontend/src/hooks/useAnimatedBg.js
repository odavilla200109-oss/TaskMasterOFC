import { useRef, useEffect, useCallback } from "react";

export function useAnimatedBg(ref, dark) {
  const tH=useRef(145), cH=useRef(145), raf=useRef(null);
  useEffect(()=>{
    const tick=()=>{
      cH.current+=(tH.current-cH.current)*.018;
      const h=cH.current;
      if(ref.current)ref.current.style.background=dark
        ?`radial-gradient(ellipse 80% 60% at 20% 30%,hsl(${h},38%,7%) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 70%,hsl(${h+20},32%,5%) 0%,transparent 60%),hsl(${h+8},28%,4%)`
        :`radial-gradient(ellipse 80% 60% at 20% 30%,hsl(${h},85%,94%) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 70%,hsl(${h+25},70%,96%) 0%,transparent 60%),hsl(${h+10},50%,98%)`;
      raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf.current);
  },[ref,dark]);
  return useCallback(e=>{tH.current=125+(e.clientX/window.innerWidth)*45;},[]);
}
