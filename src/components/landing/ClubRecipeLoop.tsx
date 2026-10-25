import { useEffect, useRef, useState } from 'react';

/** A silent decorative preview; the recipe itself remains inside the app. */
export default function ClubRecipeLoop() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(media.matches);
    syncPreference();
    media.addEventListener('change', syncPreference);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setLoad(true);
        if (!media.matches) void video.current?.play().catch(() => {});
      } else video.current?.pause();
    }, { root: element.closest('.club-public'), rootMargin: '400px 0px', threshold: 0 });
    observer.observe(element);
    return () => { observer.disconnect(); media.removeEventListener('change', syncPreference); };
  }, []);

  useEffect(() => {
    if (!load || reducedMotion) { video.current?.pause(); return; }
    if (video.current) {
      video.current.muted = true;
      void video.current.play().catch(() => {});
    }
  }, [load, reducedMotion]);

  return <div className="club-recipe-loop" ref={frame} aria-label="Demonstração do preparo do Coco Caribe, sem áudio">
    <video ref={video} src={load ? '/club-landing/coco-caribe.mp4' : undefined}
      poster="/club-landing/coco-caribe-poster.jpg" autoPlay={load && !reducedMotion}
      muted loop playsInline controls={false} disablePictureInPicture disableRemotePlayback
      preload="none" tabIndex={-1} aria-hidden="true" />
  </div>;
}
