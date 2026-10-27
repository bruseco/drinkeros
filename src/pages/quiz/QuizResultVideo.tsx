import { useEffect, useRef, useState } from "react";
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
  const soundEnabled = useRef(false);
  const [sound, setSound] = useState(false),
    [blocked, setBlocked] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const playMuted = () => {
      if (!document.hidden && !soundEnabled.current) {
        player.muted = true;
        void player.play().catch(() => setBlocked(true));
      }
    };
    const visibility = () => {
      if (document.hidden) player.pause();
      else playMuted();
    };
    playMuted();
    document.addEventListener("visibilitychange", visibility);
    return () => {
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
    <div className="relative mx-auto mb-3 aspect-square w-full max-w-[240px] max-[360px]:max-w-[200px] overflow-hidden rounded-2xl bg-black">
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
                className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-xl bg-black/85 p-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <Volume2 aria-hidden="true" className="h-4 w-4" />
                <span>Ouvir do início</span>
              </button>
            )}
          </>
        )}
    </div>
  );
}
