import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserDetailContent {
  id: string; // user_courses.id etc
  ref_id: string;
  name: string;
  cover_image_url: string | null;
  purchased_at: string;
  expires_at: string | null;
}

export interface UserDetail {
  profile: {
    id: string;
    user_id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    cpf: string | null;
    avatar_url: string | null;
    created_at: string;
    last_sign_in_provider: string | null;
  };
  role: string | null;
  plan: { plan: string; expires_at: string | null; activated_at: string; source: string } | null;
  is_lifetime: boolean;
  has_receitas: boolean;
  courses: UserDetailContent[];
  ebooks: UserDetailContent[];
  combos: UserDetailContent[];
  packages: UserDetailContent[];
  last_sign_in_at: string | null;
  certificates_count: number;
  recipe_views_count: number;
}

export const useUserDetail = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['admin-user-detail', userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserDetail> => {
      const [
        profileRes,
        roleRes,
        planRes,
        lifetimeRes,
        exclusiveRes,
        coursesRes,
        ebooksRes,
        combosRes,
        packagesRes,
        certsRes,
        viewsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId!).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId!).maybeSingle(),
        supabase.from('user_plans').select('plan, expires_at, activated_at, source').eq('user_id', userId!).maybeSingle(),
        supabase.from('user_lifetime_access').select('id').eq('user_id', userId!).maybeSingle(),
        supabase.from('user_exclusive_access').select('feature').eq('user_id', userId!).eq('feature', 'receitas').maybeSingle(),
        supabase.from('user_courses').select('id, course_id, purchased_at, expires_at, courses(name, cover_image_url)').eq('user_id', userId!),
        supabase.from('user_ebooks').select('id, ebook_id, purchased_at, expires_at, ebooks(name, cover_image_url)').eq('user_id', userId!),
        supabase.from('user_combos').select('id, combo_id, purchased_at, expires_at, combos(name, cover_image_url)').eq('user_id', userId!),
        supabase.from('user_packages').select('id, package_id, purchased_at, expires_at, packages(name, cover_image_url)').eq('user_id', userId!),
        supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', userId!),
        supabase.from('recipe_views').select('id', { count: 'exact', head: true }).eq('user_id', userId!),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (!profileRes.data) throw new Error('Usuário não encontrado');

      const mapItem = (rows: any[] | null, key: string, rel: string): UserDetailContent[] =>
        (rows || []).map((r) => ({
          id: r.id,
          ref_id: r[key],
          name: r[rel]?.name || '—',
          cover_image_url: r[rel]?.cover_image_url || null,
          purchased_at: r.purchased_at,
          expires_at: r.expires_at,
        }));

      // Get last sign in via edge function
      let lastSignIn: string | null = null;
      try {
        const { data: pwInfo } = await supabase.functions.invoke('get-user-password-info', {
          body: { userId },
        });
        lastSignIn = (pwInfo as any)?.lastSignInAt || null;
      } catch (e) { /* ignore */ }

      return {
        profile: profileRes.data as any,
        role: roleRes.data?.role || null,
        plan: planRes.data as any,
        is_lifetime: !!lifetimeRes.data,
        has_receitas: !!exclusiveRes.data,
        courses: mapItem(coursesRes.data, 'course_id', 'courses'),
        ebooks: mapItem(ebooksRes.data, 'ebook_id', 'ebooks'),
        combos: mapItem(combosRes.data, 'combo_id', 'combos'),
        packages: mapItem(packagesRes.data, 'package_id', 'packages'),
        last_sign_in_at: lastSignIn,
        certificates_count: certsRes.count || 0,
        recipe_views_count: viewsRes.count || 0,
      };
    },
  });
};

type AccessTable = 'user_courses' | 'user_ebooks' | 'user_combos' | 'user_packages';

export const useUpdateAccessExpiration = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ table, id, expires_at }: { table: AccessTable; id: string; expires_at: string | null }) => {
      const { error } = await (supabase as any).from(table).update({ expires_at }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      toast({ title: 'Expiração atualizada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
};

export const useRevokeAccess = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ table, id }: { table: AccessTable; id: string }) => {
      const { error } = await (supabase as any).from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Acesso revogado' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });
};
