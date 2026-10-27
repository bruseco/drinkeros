import "./QuizResultVideo.css";
import { useEffect, useRef, useState } from "react";
import watchArrow from "@/assets/quiz-watch-arrow.gif";
import { Volume2 } from "lucide-react";
import type { ProfileId } from "@/lib/quizLogic";
const ROOT =
  "https://pvjlcfhqueibjnkuzzna.supabase.co/storage/v1/object/public/landing-assets/quiz-results-20261027";
export const RESULT_VIDEOS: Record<ProfileId, string> = {
  pack: `${ROOT}/pack-mobile.mp4`,
  clube: `${ROOT}/clube-mobile.mp4`,
  xperience: `${ROOT}/xperience-mobile.mp4`,
  mixologia: `${ROOT}/mixologia-mobile.mp4`,
  bordo: `${ROOT}/bordo-mobile.mp4`,
  delivery: `${ROOT}/delivery-mobile.mp4`,
  eventos: `${ROOT}/eventos-mobile.mp4`,
};
export default function QuizResultVideo(
  { profile, poster }: { profile: ProfileId; poster: string },
) {
  const video = useRef<HTMLVideoElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [cueActive, setCueActive] = useState(true);
  const soundEnabled = useRef(false);
  const [sound, setSound] = useState(false),
    [blocked, setBlocked] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    let inView = true;
    const playMuted = () => {
      if (!document.hidden && inView && !soundEnabled.current) {
        player.muted = true;
        void player.play().catch(() => setBlocked(true));
      }
    };
    const visibility = () => {
      setCueActive(!document.hidden && inView);
      if (document.hidden) player.pause();
      else playMuted();
    };
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        setCueActive(inView && !document.hidden);
        if (!inView) player.pause();
        else playMuted();
      })
      : null;
    if (wrapper.current) observer?.observe(wrapper.current);
    playMuted();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      player.pause();
    };
  }, []);
  const hearFromStart = () => {
    const player = video.current;
    if (!player) return;
    soundEnabled.current = true;
    player.currentTime = 0;
    player.muted = false;
    player.loop = false;
    void player.play().then(() => {
      setSound(true);
      setBlocked(false);
    }).catch(() => {
      player.muted = true;
      soundEnabled.current = false;
      setBlocked(true);
    });
  };
  return (
    <div
      ref={wrapper}
      className="relative mx-auto mb-3 w-full max-w-[352px] sm:max-w-[260px]"
    >
      {!sound && !failed && cueActive && (
        <img aria-hidden="true" alt="" src={watchArrow} className="quiz-watch-cue pointer-events-none sm:hidden" />
      )}
      <div className="relative mx-auto aspect-square w-full min-w-0 max-w-[260px] max-[360px]:max-w-[220px] shrink overflow-hidden rounded-2xl bg-black">
        {failed
          ? (
            <img
              src={poster}
              alt="Apresentação do produto recomendado"
              className="h-full w-full object-cover"
            />
          )
          : (
            <>
              <video
                ref={video}
                src={RESULT_VIDEOS[profile]}
                poster={poster}
                autoPlay
                muted={!sound}
                loop={!sound}
                playsInline
                preload="metadata"
                controls={sound}
                onError={() => setFailed(true)}
                aria-label="Vídeo do produto recomendado"
                className="h-full w-full object-contain"
              />
              {!sound && (
                <button
                  type="button"
                  onClick={hearFromStart}
                  data-autoplay-blocked={blocked}
                  title="Reproduzir desde o início com som"
                  className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-2xl bg-black/85 p-3 text-sm font-bold text-white ring-1 ring-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Volume2 aria-hidden="true" className="h-8 w-8 motion-safe:animate-pulse" />
                  <span>Ouvir do início</span>
                </button>
              )}
            </>
          )}
      </div>
    </div>
  );
}
