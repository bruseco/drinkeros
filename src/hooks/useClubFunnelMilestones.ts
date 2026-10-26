import { useEffect, useRef, type RefObject } from 'react';
import { trackFunnel } from '@/lib/funnelTracking';

/** Public Club milestones use the page's own scrolling container. */
export function useClubFunnelMilestones(root: RefObject<HTMLDivElement>, enabled: boolean, offerOpen: boolean, userId?: string, pageKey = 'clube-receitas') {
  const halfwaySent=useRef(false);
  const offerSeenSent=useRef(false);
  useEffect(()=>{
    const element=root.current;
    if(!enabled||!element)return;
    const check=()=>{
      if(document.hidden||halfwaySent.current)return;
      const distance=element.scrollHeight-element.clientHeight;
      if(distance>0&&element.scrollTop>0&&element.scrollTop/distance>=.5){
        halfwaySent.current=true;
        trackFunnel(pageKey,'scroll_50',{userId:userId??null});
      }
    };
    element.addEventListener('scroll',check,{passive:true});
    window.addEventListener('resize',check);
    document.addEventListener('visibilitychange',check);
    check();
    return()=>{element.removeEventListener('scroll',check);window.removeEventListener('resize',check);document.removeEventListener('visibilitychange',check)};
  },[root,enabled,userId,pageKey]);
  useEffect(()=>{
    if(!enabled||!offerOpen)return;
    const check=()=>{
      if(document.hidden||offerSeenSent.current)return;
      offerSeenSent.current=true;
      trackFunnel(pageKey,'offer_viewed',{userId:userId??null});
    };
    document.addEventListener('visibilitychange',check);check();
    return()=>document.removeEventListener('visibilitychange',check);
  },[enabled,offerOpen,userId,pageKey]);
}
