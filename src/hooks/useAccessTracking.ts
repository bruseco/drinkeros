import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Registra um view de curso (uma vez por mount) */
export const useTrackCourseView = (courseId?: string | null) => {
  const { user } = useAuth();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !courseId || loggedRef.current === courseId) return;
    loggedRef.current = courseId;
    supabase
      .from('course_views')
      .insert({ user_id: user.id, course_id: courseId })
      .then(() => {});
  }, [user?.id, courseId]);
};

/** Registra um view de receita exclusiva (uma vez por mount) */
export const useTrackExclusivePostView = (postId?: string | null) => {
  const { user } = useAuth();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !postId || loggedRef.current === postId) return;
    loggedRef.current = postId;
    supabase
      .from('exclusive_post_views')
      .insert({ user_id: user.id, post_id: postId })
      .then(() => {});
  }, [user?.id, postId]);
};

/** Heartbeat: registra segundos assistidos a cada intervalo */
export const useLessonWatchHeartbeat = (
  lessonId?: string | null,
  courseId?: string | null,
  isPlaying: boolean = true,
  intervalSec: number = 15,
) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !lessonId || !isPlaying) return;
    const id = setInterval(() => {
      supabase
        .from('lesson_watch_time')
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          course_id: courseId ?? null,
          seconds_watched: intervalSec,
        })
        .then(() => {});
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [user?.id, lessonId, courseId, isPlaying, intervalSec]);
};

/** Registra clique em "Baixar" de e-book */
export const trackEbookDownload = async (userId: string, ebookId: string) => {
  await supabase.from('ebook_downloads').insert({
    user_id: userId,
    ebook_id: ebookId,
  });
};
