import React, { useRef, useCallback } from 'react';
import { Play } from 'lucide-react';

interface FullscreenVideoProps {
  embedUrl: string;
  title?: string;
  thumbnailUrl?: string;
}

export const FullscreenVideo: React.FC<FullscreenVideoProps> = ({ embedUrl, title, thumbnailUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = React.useState(false);

  const addAutoplay = (url: string) => {
    const separator = url.includes('?') ? '&' : '?';
    // mute=1 + playsinline=1 are required so mobile browsers (especially iOS)
    // actually autoplay without showing YouTube's own play overlay.
    return `${url}${separator}autoplay=1&mute=1&playsinline=1`;
  };

  const handlePlay = useCallback(() => {
    setPlaying(true);
    // Try to enter fullscreen on the container
    const el = containerRef.current;
    if (el) {
      const requestFS =
        el.requestFullscreen ||
        (el as any).webkitRequestFullscreen ||
        (el as any).msRequestFullscreen;
      if (requestFS) {
        requestFS.call(el).catch(() => {
          // Fullscreen denied by browser — video still plays inline
        });
      }
    }
  }, []);

  return (
    <div ref={containerRef} className="relative aspect-video bg-black w-full">
      {playing ? (
        <iframe
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
