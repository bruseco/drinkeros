import { useMemo } from 'react';
import { useUserCourses } from '@/hooks/useCourses';
import { useUserRecipesByPackage } from '@/hooks/useUserData';
import { useModuleProgress } from '@/hooks/useModuleProgress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CourseProgressInfo {
  progress: number;
  nextLessonId: string | null;
}

export const useCourseProgress = () => {
  const { user } = useAuth();
  const { data: userCourses = [] } = useUserCourses();
  const { data: recipesByPackage } = useUserRecipesByPackage();

  const sections = recipesByPackage?.sections ?? [];
  const viewedIds = recipesByPackage?.viewedIds ?? new Set<string>();

  // Fetch all course_packages for all user courses in one query
  const courseIds = useMemo(() => userCourses.map(uc => uc.course_id), [userCourses]);

  const { data: allCoursePackages = [] } = useQuery({
    queryKey: ['all-course-packages', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from('course_packages')
        .select('course_id, package_id, display_order')
        .in('course_id', courseIds)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: courseIds.length > 0,
  });

  const progressMap = useMemo(() => {
    const map = new Map<string, CourseProgressInfo>();

    for (const courseId of courseIds) {
      const courseModuleIds = allCoursePackages
        .filter(cp => cp.course_id === courseId)
        .map(cp => cp.package_id);

      // Gather all lessons from user's sections that belong to this course
      const courseLessons: Array<{ id: string; packageId: string }> = [];
      for (const moduleId of courseModuleIds) {
        const section = sections.find(s => s.package.id === moduleId);
        if (section) {
          for (const recipe of section.recipes) {
            courseLessons.push({ id: recipe.id, packageId: moduleId });
          }
        }
      }

      if (courseLessons.length === 0) {
        map.set(courseId, { progress: 0, nextLessonId: null });
        continue;
      }

      const completed = courseLessons.filter(l => viewedIds.has(l.id)).length;
      const progress = Math.round((completed / courseLessons.length) * 100);

      // Find next incomplete lesson (first one not viewed)
      const nextLesson = courseLessons.find(l => !viewedIds.has(l.id));

      map.set(courseId, {
        progress,
        nextLessonId: nextLesson?.id ?? null,
      });
    }

    return map;
  }, [courseIds, allCoursePackages, sections, viewedIds]);

  const getCourseProgress = (courseId: string): CourseProgressInfo => {
    return progressMap.get(courseId) ?? { progress: 0, nextLessonId: null };
  };

  return { getCourseProgress };
};
