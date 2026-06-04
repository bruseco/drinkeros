import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Throttle helper: returns true if (key) should be logged now, otherwise false.
// Stores last-log timestamp in localStorage with a TTL window.
function shouldLogOnce(key: string, ttlMs: number): boolean {
  try {
    const raw = localStorage.getItem(key);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < ttlMs) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

const VIEW_TTL_MS = 6 * 60 * 60 * 1000; // 6h — uma view por conteúdo a cada 6h por usuário

const getBrazilDateKey = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Registra 1 dia de acesso ao app por usuário para métricas de recorrência vitalícia. */
export const useTrackDailyAppAccess = () => {
  const { user } = useAuth();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const dateKey = getBrazilDateKey();
    const storageKey = `daily-app-access:${user.id}:${dateKey}`;
    if (loggedRef.current === storageKey) return;
    loggedRef.current = storageKey;

    if (!shouldLogOnce(storageKey, 24 * 60 * 60 * 1000)) return;

    (supabase as any).rpc('track_app_daily_access').then(() => {});
  }, [user?.id]);
};

/** Registra um view de curso (no máx. 1x a cada 6h por user+curso) */
export const useTrackCourseView = (courseId?: string | null) => {
  const { user } = useAuth();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !courseId || loggedRef.current === courseId) return;
    loggedRef.current = courseId;
    if (!shouldLogOnce(`cv:${user.id}:${courseId}`, VIEW_TTL_MS)) return;
    supabase
      .from('course_views')
      .insert({ user_id: user.id, course_id: courseId })
      .then(() => {});
  }, [user?.id, courseId]);
};

/** Registra um view de receita exclusiva (no máx. 1x a cada 6h por user+post) */
export const useTrackExclusivePostView = (postId?: string | null) => {
  const { user } = useAuth();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !postId || loggedRef.current === postId) return;
    loggedRef.current = postId;
    if (!shouldLogOnce(`epv:${user.id}:${postId}`, VIEW_TTL_MS)) return;
    supabase
      .from('exclusive_post_views')
      .insert({ user_id: user.id, post_id: postId })
      .then(() => {});
  }, [user?.id, postId]);
};

/**
 * Heartbeat: agrega segundos assistidos e grava em lote (a cada 60s ou ao desmontar).
 * Reduz drasticamente writes vs. a versão anterior (1 insert a cada 15s).
 */
export const useLessonWatchHeartbeat = (
  lessonId?: string | null,
  courseId?: string | null,
  isPlaying: boolean = true,
  flushIntervalSec: number = 60,
) => {
  const { user } = useAuth();
  const bufferRef = useRef(0);

  useEffect(() => {
    if (!user?.id || !lessonId || !isPlaying) return;

    const tickMs = 5_000; // contagem local de 5 em 5s
    const tick = setInterval(() => {
      bufferRef.current += tickMs / 1000;
    }, tickMs);

    const flush = () => {
      const secs = Math.round(bufferRef.current);
      bufferRef.current = 0;
      if (secs <= 0) return;
      supabase
        .from('lesson_watch_time')
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          course_id: courseId ?? null,
          seconds_watched: secs,
        })
        .then(() => {});
    };

    const flushTimer = setInterval(flush, flushIntervalSec * 1000);

    return () => {
      clearInterval(tick);
      clearInterval(flushTimer);
      flush();
    };
  }, [user?.id, lessonId, courseId, isPlaying, flushIntervalSec]);
};

/** Registra clique em "Baixar" de e-book (no máx. 1x a cada 6h por user+ebook) */
export const trackEbookDownload = async (userId: string, ebookId: string) => {
  if (!shouldLogOnce(`edl:${userId}:${ebookId}`, VIEW_TTL_MS)) return;
  await supabase.from('ebook_downloads').insert({
    user_id: userId,
    ebook_id: ebookId,
  });
};
