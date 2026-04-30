import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface CreateUserData {
  email: string;
  fullName?: string;
  packageIds?: string[];
  comboIds?: string[];
  courseIds?: string[];
  ebookIds?: string[];
}

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: data,
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuário criado com sucesso! Email de boas-vindas enviado.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useResendWelcomeEmail = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: result, error } = await supabase.functions.invoke('resend-welcome-email', {
        body: { userId },
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast({ title: 'Email de boas-vindas reenviado com nova senha temporária!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao reenviar email',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: result, error } = await supabase.functions.invoke('delete-auth-user', {
        body: { userId },
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Erro ao deletar usuário');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuário deletado com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao deletar usuário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useResetUserPassword = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data: result, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId, newPassword },
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast({ title: 'Senha redefinida com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};


export interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  role: AppRole | null;
  role_id: string | null;
  packages_count: number;
  package_ids: string[];
  combo_ids: string[];
  course_ids: string[];
  ebook_ids: string[];
  has_receitas: boolean;
  pwa_installed_at: string | null;
  last_pwa_open_at: string | null;
  has_push: boolean;
}

export interface AdminUsersResult {
  users: UserWithRole[];
  totalCount: number;
}

export type PwaFilter = 'all' | 'pwa' | 'web' | 'push' | 'no_push';
export type AdminUsersSort = 'created_desc' | 'pwa_installed_desc' | 'pwa_installed_asc' | 'last_pwa_open_desc';

export const useAdminUsers = (
  page: number = 0,
  pageSize: number = 50,
  search: string = '',
  pwaFilter: PwaFilter = 'all',
  sort: AdminUsersSort = 'created_desc',
) => {
  return useQuery({
    queryKey: ['admin-users', page, pageSize, search, pwaFilter, sort],
    queryFn: async (): Promise<AdminUsersResult> => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('profiles')
        .select('id, user_id, email, full_name, phone, created_at, pwa_installed_at, last_pwa_open_at', { count: 'exact' });

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      if (pwaFilter === 'pwa') {
        query = query.not('pwa_installed_at', 'is', null);
      } else if (pwaFilter === 'web') {
        query = query.is('pwa_installed_at', null);
      } else if (pwaFilter === 'push' || pwaFilter === 'no_push') {
        // Pre-fetch user_ids that have at least one push subscription
        const { data: pushRows, error: pushErr } = await supabase
          .from('push_subscriptions')
          .select('user_id');
        if (pushErr) throw pushErr;
        const pushUserIds = Array.from(new Set((pushRows || []).map((r: any) => r.user_id)));
        if (pwaFilter === 'push') {
          if (pushUserIds.length === 0) return { users: [], totalCount: 0 };
          query = query.in('user_id', pushUserIds);
        } else {
          if (pushUserIds.length > 0) {
            query = query.not('user_id', 'in', `(${pushUserIds.join(',')})`);
          }
        }
      }

      switch (sort) {
        case 'pwa_installed_desc':
          query = query.order('pwa_installed_at', { ascending: false, nullsFirst: false });
          break;
        case 'pwa_installed_asc':
          query = query.order('pwa_installed_at', { ascending: true, nullsFirst: false });
          break;
        case 'last_pwa_open_desc':
          query = query.order('last_pwa_open_at', { ascending: false, nullsFirst: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data: profiles, count, error: profilesError } = await query
        .range(from, to);

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        return { users: [], totalCount: count ?? 0 };
      }

      const userIds = profiles.map((p) => p.user_id);

      const [rolesResult, packagesResult, combosResult, coursesResult, ebooksResult, exclusiveResult, pushResult] = await Promise.all([
        supabase.from('user_roles').select('id, user_id, role').in('user_id', userIds),
        supabase.from('user_packages').select('user_id, package_id').in('user_id', userIds),
        supabase.from('user_combos').select('user_id, combo_id').in('user_id', userIds),
        supabase.from('user_courses').select('user_id, course_id').in('user_id', userIds),
        supabase.from('user_ebooks').select('user_id, ebook_id').in('user_id', userIds),
        supabase.from('user_exclusive_access').select('user_id, feature').eq('feature', 'receitas').in('user_id', userIds),
        supabase.from('push_subscriptions').select('user_id').in('user_id', userIds),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (packagesResult.error) throw packagesResult.error;
      if (combosResult.error) throw combosResult.error;
      if (coursesResult.error) throw coursesResult.error;
      if (ebooksResult.error) throw ebooksResult.error;
      if (exclusiveResult.error) throw exclusiveResult.error;
      if (pushResult.error) throw pushResult.error;

      const pushSet = new Set((pushResult.data || []).map((p: any) => p.user_id));

      const rolesMap = new Map(rolesResult.data?.map((r) => [r.user_id, { role: r.role, id: r.id }]));
      
      const exclusiveSet = new Set((exclusiveResult.data || []).map((e) => e.user_id));

      const packagesMap = new Map<string, string[]>();
      packagesResult.data?.forEach((up) => {
        const existing = packagesMap.get(up.user_id) || [];
        existing.push(up.package_id);
        packagesMap.set(up.user_id, existing);
      });

      const combosMap = new Map<string, string[]>();
      combosResult.data?.forEach((uc) => {
        const existing = combosMap.get(uc.user_id) || [];
        existing.push(uc.combo_id);
        combosMap.set(uc.user_id, existing);
      });

      const coursesMap = new Map<string, string[]>();
      coursesResult.data?.forEach((uc) => {
        const existing = coursesMap.get(uc.user_id) || [];
        existing.push(uc.course_id);
        coursesMap.set(uc.user_id, existing);
      });

      const ebooksMap = new Map<string, string[]>();
      ebooksResult.data?.forEach((ue) => {
        const existing = ebooksMap.get(ue.user_id) || [];
        existing.push(ue.ebook_id);
        ebooksMap.set(ue.user_id, existing);
      });

      const users: UserWithRole[] = profiles.map((profile) => {
        const roleData = rolesMap.get(profile.user_id);
        const packageIds = packagesMap.get(profile.user_id) || [];
        const comboIds = combosMap.get(profile.user_id) || [];
        const courseIds = coursesMap.get(profile.user_id) || [];
        const ebookIds = ebooksMap.get(profile.user_id) || [];
        const hasReceitas = exclusiveSet.has(profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          created_at: profile.created_at,
          role: roleData?.role || null,
          role_id: roleData?.id || null,
          packages_count: courseIds.length + ebookIds.length + (hasReceitas ? 1 : 0),
          package_ids: packageIds,
          combo_ids: comboIds,
          course_ids: courseIds,
          ebook_ids: ebookIds,
          has_receitas: hasReceitas,
          pwa_installed_at: (profile as any).pwa_installed_at ?? null,
          last_pwa_open_at: (profile as any).last_pwa_open_at ?? null,
          has_push: pushSet.has(profile.user_id),
        };
      });

      return { users, totalCount: count ?? 0 };
    },
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      role, 
      existingRoleId 
    }: { 
      userId: string; 
      role: AppRole | null; 
      existingRoleId: string | null;
    }) => {
      if (existingRoleId && role === null) {
        const { error } = await supabase.from('user_roles').delete().eq('id', existingRoleId);
        if (error) throw error;
      } else if (existingRoleId && role) {
        const { error } = await supabase.from('user_roles').update({ role }).eq('id', existingRoleId);
        if (error) throw error;
      } else if (!existingRoleId && role) {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Permissão atualizada com sucesso' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar permissão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateUserAccess = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      currentPackageIds, newPackageIds,
      currentComboIds, newComboIds,
      currentCourseIds, newCourseIds,
      currentEbookIds = [], newEbookIds = [],
    }: { 
      userId: string; 
      currentPackageIds: string[]; newPackageIds: string[];
      currentComboIds: string[]; newComboIds: string[];
      currentCourseIds: string[]; newCourseIds: string[];
      currentEbookIds?: string[]; newEbookIds?: string[];
    }) => {
      // Packages
      const pkgRemove = currentPackageIds.filter((id) => !newPackageIds.includes(id));
      const pkgAdd = newPackageIds.filter((id) => !currentPackageIds.includes(id));
      if (pkgRemove.length > 0) {
        const { error } = await supabase.from('user_packages').delete().eq('user_id', userId).in('package_id', pkgRemove);
        if (error) throw error;
      }
      if (pkgAdd.length > 0) {
        const { error } = await supabase.from('user_packages').insert(pkgAdd.map((id) => ({ user_id: userId, package_id: id })));
        if (error) throw error;
      }

      // Combos
      const comboRemove = currentComboIds.filter((id) => !newComboIds.includes(id));
      const comboAdd = newComboIds.filter((id) => !currentComboIds.includes(id));
      if (comboRemove.length > 0) {
        const { error } = await supabase.from('user_combos').delete().eq('user_id', userId).in('combo_id', comboRemove);
        if (error) throw error;
      }
      if (comboAdd.length > 0) {
        const { error } = await supabase.from('user_combos').insert(comboAdd.map((id) => ({ user_id: userId, combo_id: id })));
        if (error) throw error;
      }

      // Courses
      const courseRemove = currentCourseIds.filter((id) => !newCourseIds.includes(id));
      const courseAdd = newCourseIds.filter((id) => !currentCourseIds.includes(id));
      if (courseRemove.length > 0) {
        const { error } = await supabase.from('user_courses').delete().eq('user_id', userId).in('course_id', courseRemove);
        if (error) throw error;
      }
      if (courseAdd.length > 0) {
        const { error } = await supabase.from('user_courses').insert(courseAdd.map((id) => ({ user_id: userId, course_id: id })));
        if (error) throw error;
      }

      // Ebooks
      const ebookRemove = currentEbookIds.filter((id) => !newEbookIds.includes(id));
      const ebookAdd = newEbookIds.filter((id) => !currentEbookIds.includes(id));
      if (ebookRemove.length > 0) {
        const { error } = await supabase.from('user_ebooks').delete().eq('user_id', userId).in('ebook_id', ebookRemove);
        if (error) throw error;
      }
      if (ebookAdd.length > 0) {
        const { error } = await supabase.from('user_ebooks').insert(ebookAdd.map((id) => ({ user_id: userId, ebook_id: id })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Acessos atualizados com sucesso' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar acessos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      fullName,
      phone,
      email,
      originalEmail,
    }: {
      userId: string;
      fullName: string;
      phone: string;
      email: string;
      originalEmail: string;
    }) => {
      // If email changed, sync auth.users first
      if (email !== originalEmail) {
        const { data: result, error } = await supabase.functions.invoke('update-auth-email', {
          body: { userId, newEmail: email },
        });
        if (error) {
          // Extract real error message from FunctionsHttpError
          try {
            const body = await (error as any).context?.json?.();
            throw new Error(body?.error || error.message || 'Erro ao atualizar email');
          } catch (e) {
            if (e instanceof Error && e.message !== error.message) throw e;
            throw new Error(error.message || 'Erro ao atualizar email');
          }
        }
        if (!result?.success) throw new Error(result?.error || 'Erro desconhecido ao atualizar email');
      }

      // Update profiles table (email is handled by edge function above)
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          phone: phone || null,
        })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Dados do usuário atualizados com sucesso!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar dados',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Keep backward compat
export const useUpdateUserPackages = useUpdateUserAccess;
