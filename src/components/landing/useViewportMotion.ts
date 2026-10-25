import { useEffect, useState, type RefObject } from 'react';

/** Motion runs only inside the page scroller, in a visible tab, respecting reduced motion. */
export function useViewportMotion<T extends HTMLElement>(ref: RefObject<T>) {
  const [active,setActive] = useState(false);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView=false;
    const sync=()=>setActive(inView&&!document.hidden&&!media.matches);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting&&entry.intersectionRatio>0;sync()}, {root:element.closest('.club-public'),threshold:[0,.01]});
    observer.observe(element);document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync)};
  },[ref]);
  return active;
}
