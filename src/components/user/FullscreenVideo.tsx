import React, { useRef, useCallback, useEffect } from 'react';
import { Play, ExternalLink } from 'lucide-react';
import {
  extractYouTubeId,
  buildYouTubeEmbedUrl,
  getYouTubeThumbnail,
  getYouTubeWatchUrl,
  isYouTubeUrl,
} from '@/lib/youtube';

interface FullscreenVideoProps {
  /** Pre-built embed URL (used for Vimeo, or fallback). For YouTube, prefer passing the raw URL via `sourceUrl`. */
  embedUrl: string;
  /** Original/raw URL (used to detect YouTube and build a safe fallback link). */
  sourceUrl?: string;
  title?: string;
  thumbnailUrl?: string;
}

export const FullscreenVideo: React.FC<FullscreenVideoProps> = ({
  embedUrl,
  sourceUrl,
  title,
  thumbnailUrl,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = React.useState(false);

  // Detect YouTube from either the source or embed URL
  const ytId =
    extractYouTubeId(sourceUrl) || extractYouTubeId(embedUrl);
  const isYouTube = !!ytId || isYouTubeUrl(sourceUrl) || isYouTubeUrl(embedUrl);

  const effectiveEmbedUrl = ytId ? buildYouTubeEmbedUrl(ytId) : embedUrl;
  const effectiveThumbnail =
    thumbnailUrl || (ytId ? getYouTubeThumbnail(ytId) : undefined);

  const addVimeoAutoplay = (url: string) => {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}autoplay=1&muted=1&playsinline=1`;
  };

  const handlePlay = useCallback(() => {
    setPlaying(true);
    // Only auto-fullscreen for non-YouTube (Vimeo) where autoplay works reliably.
    if (isYouTube) return;
    const el = containerRef.current;
    if (el) {
      const requestFS =
        el.requestFullscreen ||
        (el as any).webkitRequestFullscreen ||
        (el as any).msRequestFullscreen;
      if (requestFS) {
        requestFS.call(el).catch(() => {});
      }
    }
  }, [isYouTube]);

  // Vimeo-only: unmute on first user interaction.
  useEffect(() => {
    if (!playing || isYouTube) return;
    let unmuted = false;
    const unmute = () => {
      if (unmuted) return;
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        unmuted = true;
        cleanup();
      }
    };
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'touchstart',
      'keydown',
      'scroll',
      'wheel',
    ];
    const cleanup = () => events.forEach((e) => window.removeEventListener(e, unmute));
    events.forEach((e) => window.addEventListener(e, unmute, { passive: true }));
    return cleanup;
  }, [playing, isYouTube]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="relative aspect-video bg-black w-full">
        {playing ? (
          <iframe
            ref={iframeRef}
            src={isYouTube ? effectiveEmbedUrl : addVimeoAutoplay(effectiveEmbedUrl)}
            title={title}
            className="h-full w-full"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        ) : (
          <button
            onClick={handlePlay}
            className="relative w-full h-full flex items-center justify-center group cursor-pointer"
            aria-label="Reproduzir vídeo"
          >
            {effectiveThumbnail ? (
              <img
                src={effectiveThumbnail}
                alt={title || 'Video thumbnail'}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-muted" />
            )}
            <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-primary/90 text-primary-foreground shadow-xl transition-transform group-hover:scale-110">
              <Play className="h-7 w-7 ml-1" fill="currentColor" />
            </div>
          </button>
        )}
      </div>

      {isYouTube && ytId && (
        <div className="flex justify-center py-2">
          <a
            href={getYouTubeWatchUrl(ytId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Problemas para assistir? Abrir no YouTube
          </a>
        </div>
      )}
    </div>
  );
};
