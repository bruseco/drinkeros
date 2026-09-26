import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, Play, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import drinkerosLogo from "@/assets/logotipo-drinkeros.png";
import barEventosCover from "@/assets/landing/rand-business/bar-eventos.jpg";
import bartenderBordoCover from "@/assets/landing/rand-business/bartender-bordo.jpg";
import drinkDeliveryCover from "@/assets/landing/rand-business/drinkdelivery.jpg";
import mixologiaAvancadaCover from "@/assets/landing/rand-business/mixologia-avancada.jpg";

const VIDEO_ID = "gY-z19R0xP4";
const REVEAL_AFTER_SECONDS = 225;
const OFFER_SECONDS = 300;

type PlayerStateEvent = { data: number };
type PlayerEvent = { target: YouTubePlayer };

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
};

type YouTubeConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady: (event: PlayerEvent) => void;
      onStateChange: (event: PlayerStateEvent) => void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: { Player: YouTubeConstructor; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const VIDEO_MILESTONES = [
  { key: "video_start", ratio: 0 },
  { key: "video_25", ratio: 0.25 },
  { key: "video_50", ratio: 0.5 },
  { key: "video_75", ratio: 0.75 },
  { key: "video_90", ratio: 0.9 },
  { key: "video_complete", ratio: 0.98 },
] as const;

const COURSES = [
  {
    name: "Bar p/ Eventos",
    description: "Aprenda a estruturar, vender e operar serviços de bar para festas, casamentos e eventos.",
    cover: barEventosCover,
  },
  {
    name: "Bartender a Bordo",
    description: "Prepare-se para trabalhar em cruzeiros, viajar o mundo e receber em moeda estrangeira.",
    cover: bartenderBordoCover,
  },
  {
    name: "DrinkDelivery & Engarrafados",
    description: "Crie uma operação de drinks engarrafados para delivery, encomendas, empórios e restaurantes.",
    cover: drinkDeliveryCover,
  },
  {
    name: "Mixologia Avançada",
    description: "Aprofunde técnica, repertório, atendimento e domínio profissional da coquetelaria.",
    cover: mixologiaAvancadaCover,
  },
] as const;

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
};

const showDemoNotice = () => toast.info("Modo de demonstração", {
  description: "Nenhuma cobrança será realizada",
});

interface RandObrigadoDemoProps {
  forceReveal: boolean;
}

export default function RandObrigadoDemo({ forceReveal }: RandObrigadoDemoProps) {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isPlayingRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  const watchedSecondsRef = useRef(forceReveal ? REVEAL_AFTER_SECONDS : 0);
  const milestoneKeysRef = useRef(new Set<string>());
  const [playerReady, setPlayerReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [revealed, setRevealed] = useState(forceReveal);
  const [countdown, setCountdown] = useState(OFFER_SECONDS);

  const collectFutureMilestones = useCallback((currentTime: number, duration: number) => {
    // Intencionalmente não envia nada no demo. Esta função mantém os marcos prontos
    // para uma futura integração real com deduplicação por milestoneKeysRef.
    if (duration <= 0) return;
    VIDEO_MILESTONES.forEach(({ key, ratio }) => {
      const reached = ratio === 0 ? currentTime > 0 : currentTime / duration >= ratio;
      if (reached) milestoneKeysRef.current.add(key);
    });
  }, []);

  useEffect(() => {
    if (forceReveal || !isPlayingRef.current) return;
    const interval = window.setInterval(() => {
      if (!isPlayingRef.current || document.hidden) {
        lastTickRef.current = null;
        return;
      }
      const now = performance.now();
      const last = lastTickRef.current;
      lastTickRef.current = now;
      if (last === null) return;
      watchedSecondsRef.current += Math.min((now - last) / 1000, 1.5);
      const player = playerRef.current;
      if (player) collectFutureMilestones(player.getCurrentTime(), player.getDuration());
      if (watchedSecondsRef.current >= REVEAL_AFTER_SECONDS) setRevealed(true);
    }, 500);
    return () => window.clearInterval(interval);
  }, [collectFutureMilestones, forceReveal]);

  useEffect(() => {
    if (!revealed || countdown <= 0) return;
    const interval = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [countdown, revealed]);

  const activateVideo = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.playVideo();
      player.unMute();
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (forceReveal) return;
    const host = playerHostRef.current;
    if (!host) return;

    let cancelled = false;
    const createPlayer = () => {
      if (cancelled || !window.YT?.Player || playerRef.current) return;
      playerRef.current = new window.YT.Player(host, {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            setPlayerReady(true);
            target.mute();
            target.playVideo();
          },
          onStateChange: ({ data }) => {
            const playing = data === window.YT?.PlayerState.PLAYING;
            isPlayingRef.current = playing;
            lastTickRef.current = playing ? performance.now() : null;
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        createPlayer();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
    }

    const activateFromPage = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      activateVideo();
    };
    document.addEventListener("pointerdown", activateFromPage, { once: true });
    document.addEventListener("keydown", activateFromPage);

    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", activateFromPage);
      document.removeEventListener("keydown", activateFromPage);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [activateVideo, forceReveal]);

  const demoEnded = countdown === 0;

  return (
    <div className="min-h-screen bg-background text-foreground pb-[env(safe-area-inset-bottom)]">
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-x-0 top-0 z-50 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-lg ${
          revealed
            ? "border-warning/60 bg-warning text-warning-foreground"
            : "border-destructive/60 bg-destructive text-destructive-foreground"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 text-center text-sm font-bold sm:text-base">
          {revealed ? (
            <>
              <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />
              {demoEnded ? (
                <span>A demonstração terminou</span>
              ) : (
                <span>Condição especial disponível por {formatCountdown(countdown)}</span>
              )}
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
              <span>Não feche esta página — estamos processando e preparando o seu acesso.</span>
            </>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-12 pt-[calc(env(safe-area-inset-top)+6.5rem)] sm:px-6 sm:pt-28">
        <header className="mx-auto max-w-3xl text-center">
          <img src={drinkerosLogo} alt="Drinkeros" className="mx-auto h-8 w-auto opacity-90 sm:h-10" />
          <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Compra do RAND garantida
          </div>
          <h1 className="mt-5 text-balance text-3xl font-bold leading-tight sm:text-5xl">
            Seus clássicos estão garantidos. Agora falta transformar técnica em oportunidade.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Assista ao recado abaixo enquanto preparamos seu acesso.
          </p>
        </header>

        {!forceReveal && (
          <section className="mx-auto mt-8 max-w-4xl" aria-label="Apresentação do Pacote Business">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
              <div ref={playerHostRef} className="absolute inset-0 h-full w-full" />
              {!playerReady && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card">
                  <img
                    src={`https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`}
                    alt="Apresentação em vídeo do Pacote Business"
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                    loading="eager"
                  />
                  <Loader2 className="relative h-8 w-8 animate-spin text-primary" aria-label="Carregando vídeo" />
                </div>
              )}
              {!soundEnabled && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={activateVideo}
                  className="absolute bottom-3 left-1/2 z-10 h-11 -translate-x-1/2 gap-2 border border-foreground/20 bg-background/90 px-4 text-foreground shadow-lg"
                >
                  {playerReady ? <Volume2 aria-hidden="true" /> : <Play aria-hidden="true" />}
                  Toque para ativar o som
                </Button>
              )}
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              A oferta será apresentada após 3:45 de reprodução do vídeo.
            </p>
          </section>
        )}

        {revealed && (
          <section className="mt-9 animate-fade-in" aria-labelledby="business-offer-title">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 text-sm font-bold uppercase text-primary">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Pacote Business
              </p>
              <h2 id="business-offer-title" className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-5xl">
                Quatro caminhos para transformar coquetelaria em negócio
              </h2>
              <div className="mt-6 flex flex-wrap items-end justify-center gap-x-4 gap-y-1">
                <p className="text-lg text-muted-foreground line-through">Valor avulso R$ 2.288</p>
                <p className="text-4xl font-black text-success sm:text-5xl">R$ 97</p>
              </div>
              <p className="mt-2 text-sm font-medium text-muted-foreground">condição promocional · pagamento único</p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {COURSES.map((course) => (
                <article key={course.name} className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                  <div className="aspect-[3/2] overflow-hidden bg-muted">
                    <img
                      src={course.cover}
                      alt={`Capa do curso ${course.name}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold leading-tight">{course.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{course.description}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mx-auto mt-8 max-w-2xl text-center">
              <Button
                type="button"
                size="lg"
                onClick={showDemoNotice}
                className="min-h-16 w-full whitespace-normal bg-success px-5 py-3 text-base font-black text-success-foreground hover:bg-success/90 sm:text-lg"
              >
                QUERO APROVEITAR A SUPER OFERTA!
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={showDemoNotice}
                className="mt-3 h-auto w-full whitespace-normal px-2 py-2 text-sm font-normal leading-relaxed text-muted-foreground"
              >
                Perder esta oferta e deixar mais de R$ 2.000 em conhecimento ir embora.
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">
                Demonstração visual: nenhum pagamento ou alteração de acesso será realizado.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}