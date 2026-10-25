import { useEffect, useRef, useState } from 'react';
import { useViewportMotion } from './useViewportMotion';

/** Silent own-hosted video; fetch near the viewport, decode/play only while visible. */
export default function ClubRecipeLoop() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [load,setLoad] = useState(false);
  const active = useViewportMotion(frame);
  useEffect(()=>{
    const element=frame.current;if(!element)return;
    const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setLoad(true);observer.disconnect()}},{root:element.closest('.club-public'),rootMargin:'400px 0px'});
    observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const element=video.current;if(!element)return;
    element.defaultMuted=true;element.muted=true;element.setAttribute('muted','');
    if(!load||!active){element.pause();return}
    const play=()=>{void element.play().catch(()=>{/* Keep the poster if this browser blocks autoplay. */})};
    play();element.addEventListener('canplay',play);element.addEventListener('loadeddata',play);
    document.addEventListener('pointerdown',play);document.addEventListener('keydown',play);
    return()=>{element.pause();element.removeEventListener('canplay',play);element.removeEventListener('loadeddata',play);document.removeEventListener('pointerdown',play);document.removeEventListener('keydown',play)};
  },[load,active]);
  return <div className="club-recipe-loop" ref={frame} data-motion-active={active} aria-label="Demonstração do preparo do Coco Caribe, sem áudio">
    <video ref={video} src={load?'/club-landing/coco-caribe.mp4':undefined} poster="/club-landing/coco-caribe-poster.jpg"
      autoPlay={active} muted loop playsInline controls={false} disablePictureInPicture disableRemotePlayback preload="metadata" tabIndex={-1} aria-hidden="true" />
  </div>;
}
