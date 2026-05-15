import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccessMetrics {
  total_sessions: number;
  unique_users: number;
  total_watch_seconds: number;
  certificates_total: number;
  users_by_plan: { free: number; aluno: number; socio: number; vitalicio: number; total: number };
  accesses_by_plan: { free: number; aluno: number; socio: number; vitalicio: number; unknown: number };
  unique_users_by_plan: { free: number; aluno: number; socio: number; vitalicio: number };
  top_courses_views: Array<{ id: string; name: string; cover_image_url: string | null; views: number }>;
  top_courses_watch_time: Array<{ id: string; name: string; cover_image_url: string | null; total_seconds: number; unique_users: number }>;
  top_exclusive_posts: Array<{ id: string; name: string; cover_image_url: string | null; views: number }>;
  top_active_users: Array<{
    user_id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    sessions: number;
    points: number;
    sessions_count: number;
    exclusive_posts: number;
    lessons: number;
    courses: number;
    ebooks: number;
    certificates: number;
  }>;
  certificates_generated: Array<{ name: string; type: string; total: number }>;
  top_ebooks_downloads: Array<{ id: string; name: string; cover_image_url: string | null; downloads: number }>;
}

export const useAccessMetrics = (from: Date, to: Date) => {
  return useQuery({
    queryKey: ['access-metrics', from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<AccessMetrics> => {
      const { data, error } = await (supabase as any).rpc('get_access_metrics', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return data as AccessMetrics;
    },
    staleTime: 30_000,
  });
};
