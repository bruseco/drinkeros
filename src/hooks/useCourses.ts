import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Course {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  hotmart_product_code: string | null;
  woocommerce_product_id: string | null;
  is_active: boolean;
  is_free: boolean;
  is_available_for_sale: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface CoursePackage {
  id: string;
  course_id: string;
  package_id: string;
  display_order: number;
  package?: {
    id: string;
    name: string;
    cover_image_url: string | null;
  };
}

export interface UserCourseWithDetails {
  id: string;
  course_id: string;
  purchased_at: string;
  course: Course;
  modules: Array<{
    id: string;
    name: string;
    cover_image_url: string | null;
  }>;
}

export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at'>;
export type CourseUpdate = Partial<CourseInsert>;

export const useCourses = (activeOnly = false) => {
  return useQuery({
    queryKey: ['courses', { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Course[];
    },
  });
};

export const useCourse = (id: string) => {
  return useQuery({
    queryKey: ['courses', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Course;
    },
    enabled: !!id,
  });
};

export const useCourseBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['courses', 'slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as Course;
    },
    enabled: !!slug,
  });
};

export const useCoursePackages = (courseId: string) => {
  return useQuery({
    queryKey: ['course-packages', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_packages')
        .select(`
          id,
          course_id,
          package_id,
          display_order,
          package:packages(id, name, cover_image_url)
        `)
        .eq('course_id', courseId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as unknown as CoursePackage[];
    },
    enabled: !!courseId,
  });
};

export const useCreateCourse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (course: CourseInsert) => {
      const { data, error } = await supabase
        .from('courses')
        .insert(course)
        .select()
        .single();

      if (error) throw error;
      return data as Course;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: 'Curso criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar curso', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateCourse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CourseUpdate }) => {
      const { data: updated, error } = await supabase
        .from('courses')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Course;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: 'Curso atualizado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar curso', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteCourse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: 'Curso excluído com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir curso', description: error.message, variant: 'destructive' });
    },
  });
};

export const useSaveCoursePackages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courseId, packageIds }: { courseId: string; packageIds: string[] }) => {
      // Delete existing
      await supabase.from('course_packages').delete().eq('course_id', courseId);

      // Insert new ones
      if (packageIds.length > 0) {
        const rows = packageIds.map((pid, idx) => ({
          course_id: courseId,
          package_id: pid,
          display_order: idx,
        }));

        const { error } = await supabase.from('course_packages').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-packages'] });
    },
  });
};

export const useUserCourses = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-courses', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's purchased courses
      const { data: userCourses, error: ucError } = await supabase
        .from('user_courses')
        .select(`
          id,
          course_id,
          purchased_at,
          course:courses(*)
        `)
        .eq('user_id', user.id);

      if (ucError) throw ucError;

      // Get free courses
      const { data: freeCourses, error: fcError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_free', true)
        .eq('is_active', true);

      if (fcError) throw fcError;

      // Combine purchased + free avoiding duplicates
      const purchasedCourseIds = new Set((userCourses || []).map(uc => uc.course_id));

      const purchased = (userCourses || []).map(uc => ({
        id: uc.id,
        course_id: uc.course_id,
        purchased_at: uc.purchased_at,
        course: uc.course as unknown as Course,
      }));

      const freeAsUserCourses = (freeCourses || [])
        .filter(fc => !purchasedCourseIds.has(fc.id))
        .map(fc => ({
          id: `free-${fc.id}`,
          course_id: fc.id,
          purchased_at: new Date().toISOString(),
          course: fc as Course,
        }));

      const allUserCourses = [...purchased, ...freeAsUserCourses];

      // Get modules for each course
      const courseIds = allUserCourses.map(uc => uc.course_id);
      if (courseIds.length === 0) return [];

      const { data: coursePackages, error: cpError } = await supabase
        .from('course_packages')
        .select(`
          course_id,
          package_id,
          display_order,
          package:packages(id, name, cover_image_url)
        `)
        .in('course_id', courseIds)
        .order('display_order', { ascending: true });

      if (cpError) throw cpError;

      // Build result with modules
      return allUserCourses.map(uc => ({
        ...uc,
        modules: (coursePackages || [])
          .filter(cp => cp.course_id === uc.course_id)
          .map(cp => {
            const pkg = cp.package as unknown as { id: string; name: string; cover_image_url: string | null };
            return {
              id: pkg.id,
              name: pkg.name,
              cover_image_url: pkg.cover_image_url,
            };
          }),
      })) as UserCourseWithDetails[];
    },
    enabled: !!user,
  });
};
