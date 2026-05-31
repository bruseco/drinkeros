// Helpers for safe YouTube embedding (avoids anti-bot blocks).

export const extractYouTubeId = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const trimmed = url.trim();
    // Direct ID fallback
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const regex =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

export const isYouTubeUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return /youtu\.?be/i.test(url);
};

export const buildYouTubeEmbedUrl = (videoId: string): string =>
  `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`;

export const getYouTubeThumbnail = (videoId: string): string =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

export const getYouTubeWatchUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`;
