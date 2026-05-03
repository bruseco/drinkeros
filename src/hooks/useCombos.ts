import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Course } from '@/hooks/useCourses';

export interface Combo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  checkout_url: string | null;
  is_active: boolean;
  is_free: boolean;
  is_available_for_sale: boolean;
  display_order: number | null;
  price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ComboCourse {
  id: string;
  combo_id: string;
  course_id: string;
  display_order: number;
  course?: {
    id: string;
    name: string;
    cover_image_url: string | null;
  };
}

export interface UserComboWithDetails {
  id: string;
  combo_id: string;
  purchased_at: string;
  combo: Combo;
  courses: Array<{
    id: string;
    name: string;
    cover_image_url: string | null;
  }>;
}

export type ComboInsert = Omit<Combo, 'id' | 'created_at' | 'updated_at'>;
export type ComboUpdate = Partial<ComboInsert>;

export const useCombos = (activeOnly = false) => {
  return useQuery({
    queryKey: ['combos', { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from('combos')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Combo[];
    },
  });
};

export const useComboBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['combos', 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combos')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data as Combo | null;
    },
    enabled: !!slug,
  });
};

export const useCombo = (id: string) => {
  return useQuery({
    queryKey: ['combos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Combo;
    },
    enabled: !!id,
  });
};

export const useComboCourses = (comboId: string) => {
  return useQuery({
    queryKey: ['combo-courses', comboId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('combo_courses')
        .select(`
          id,
          combo_id,
          course_id,
          display_order,
          course:courses(id, name, cover_image_url)
        `)
        .eq('combo_id', comboId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as unknown as ComboCourse[];
    },
    enabled: !!comboId,
  });
};

export const useCreateCombo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (combo: ComboInsert) => {
      const { data, error } = await supabase
        .from('combos')
        .insert(combo)
        .select()
        .single();

      if (error) throw error;
      return data as Combo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast({ title: 'Combo criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar combo', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateCombo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ComboUpdate }) => {
      const { data: updated, error } = await supabase
        .from('combos')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Combo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast({ title: 'Combo atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar combo', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteCombo = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('combos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast({ title: 'Combo excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir combo', description: error.message, variant: 'destructive' });
    },
  });
};

export const useSaveComboCourses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comboId, courseIds }: { comboId: string; courseIds: string[] }) => {
      // Delete existing
      await supabase.from('combo_courses').delete().eq('combo_id', comboId);

      // Insert new ones
      if (courseIds.length > 0) {
        const rows = courseIds.map((cid, idx) => ({
          combo_id: comboId,
          course_id: cid,
          display_order: idx,
        }));

        const { error } = await supabase.from('combo_courses').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combo-courses'] });
    },
  });
};

export const useUserCombos = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-combos', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const [{ data: planRow }, { data: lifetime }] = await Promise.all([
        supabase.from('user_plans').select('plan, expires_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_lifetime_access').select('id').eq('user_id', user.id).maybeSingle(),
      ]);
      const now = new Date();
      const vipActive = planRow?.plan === 'vip' && (!planRow?.expires_at || new Date(planRow.expires_at) > now);
      const vipExpiresAt = vipActive ? planRow?.expires_at ?? null : null;
      const isLifetime = !!lifetime;

      // Get user's purchased combos (todos)
      const { data: userCombos, error: ucError } = await supabase
        .from('user_combos')
        .select(`
          id,
          combo_id,
          purchased_at,
          expires_at,
          combo:combos(*)
        `)
        .eq('user_id', user.id);

      if (ucError) throw ucError;

      // Get free combos
      const { data: freeCombos, error: fcError } = await supabase
        .from('combos')
        .select('*')
        .eq('is_free', true)
        .eq('is_active', true);

      if (fcError) throw fcError;

      const activeUserCombos = (userCombos || []).filter((uc) => {
        if (isLifetime) return true;
        if (!uc.expires_at) return true;
        if (new Date(uc.expires_at) > now) return true;
        if (vipExpiresAt && new Date(vipExpiresAt) > now) return true;
        return false;
      });

      // Combine purchased + free avoiding duplicates
      const purchasedComboIds = new Set(activeUserCombos.map(uc => uc.combo_id));

      const purchased = activeUserCombos.map(uc => ({
        id: uc.id,
        combo_id: uc.combo_id,
        purchased_at: uc.purchased_at,
        combo: uc.combo as unknown as Combo,
      }));

      const freeAsUserCombos = (freeCombos || [])
        .filter(fc => !purchasedComboIds.has(fc.id))
        .map(fc => ({
          id: `free-${fc.id}`,
          combo_id: fc.id,
          purchased_at: new Date().toISOString(),
          combo: fc as Combo,
        }));

      const allUserCombos = [...purchased, ...freeAsUserCombos];

      // Get courses for each combo
      const comboIds = allUserCombos.map(uc => uc.combo_id);
      if (comboIds.length === 0) return [];

      const { data: comboCourses, error: ccError } = await supabase
        .from('combo_courses')
        .select(`
          combo_id,
          course_id,
          display_order,
          course:courses(id, name, cover_image_url)
        `)
        .in('combo_id', comboIds)
        .order('display_order', { ascending: true });

      if (ccError) throw ccError;

      return allUserCombos.map(uc => ({
        ...uc,
        courses: (comboCourses || [])
          .filter(cc => cc.combo_id === uc.combo_id)
          .map(cc => {
            const course = cc.course as unknown as { id: string; name: string; cover_image_url: string | null };
            return {
              id: course.id,
              name: course.name,
              cover_image_url: course.cover_image_url,
            };
          }),
      })) as UserComboWithDetails[];
    },
    enabled: !!user,
  });
};
