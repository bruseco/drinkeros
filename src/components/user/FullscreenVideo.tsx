import React, { useRef, useCallback, useEffect } from 'react';
import { Play } from 'lucide-react';

interface FullscreenVideoProps {
  embedUrl: string;
  title?: string;
  thumbnailUrl?: string;
}

export const FullscreenVideo: React.FC<FullscreenVideoProps> = ({ embedUrl, title, thumbnailUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = React.useState(false);

  const addAutoplay = (url: string) => {
    const separator = url.includes('?') ? '&' : '?';
    // mute=1 + playsinline=1 are required so mobile browsers (especially iOS)
    // actually autoplay without showing YouTube's own play overlay.
    // enablejsapi=1 lets us postMessage to unmute after user interaction.
    return `${url}${separator}autoplay=1&mute=1&playsinline=1&enablejsapi=1`;
  };

  const handlePlay = useCallback(() => {
    setPlaying(true);
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
  }, []);

  // After play starts, unmute on first user interaction (scroll / touch / click)
  useEffect(() => {
    if (!playing) return;
    let unmuted = false;
    const unmute = () => {
      if (unmuted) return;
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        unmuted = true;
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        cleanup();
      }
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
    const cleanup = () => events.forEach(e => window.removeEventListener(e, unmute));
    events.forEach(e => window.addEventListener(e, unmute, { passive: true }));
    return cleanup;
  }, [playing]);

  return (
    <div ref={containerRef} className="relative aspect-video bg-black w-full">
      {playing ? (
        <iframe
          ref={iframeRef}
          src={addAutoplay(embedUrl)}
          title={title}
          className="h-full w-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        />
      ) : (
        <button
          onClick={handlePlay}
          className="relative w-full h-full flex items-center justify-center group cursor-pointer"
          aria-label="Reproduzir vídeo"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title || 'Video thumbnail'}
              className="absolute inset-0 w-full h-full object-cover"
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
  );
};
