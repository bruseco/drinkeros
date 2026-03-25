import { useMemo } from 'react';
import type { PackageWithRecipes } from '@/hooks/useUserData';

interface ModuleProgressResult {
  completedModules: PackageWithRecipes[];
  inProgressModules: PackageWithRecipes[];
  getModuleProgress: (moduleId: string) => number;
}

export const useModuleProgress = (
  sections: PackageWithRecipes[],
  viewedIds: Set<string>
): ModuleProgressResult => {
  return useMemo(() => {
    const completedModules: PackageWithRecipes[] = [];
    const inProgressModules: PackageWithRecipes[] = [];

    for (const section of sections) {
      if (section.recipes.length === 0) {
        inProgressModules.push(section);
        continue;
      }

      const allCompleted = section.recipes.every((r) => viewedIds.has(r.id));

      if (allCompleted) {
        completedModules.push(section);
      } else {
        inProgressModules.push(section);
      }
    }

    const getModuleProgress = (moduleId: string): number => {
      const section = sections.find((s) => s.package.id === moduleId);
      if (!section || section.recipes.length === 0) return 0;
      const completed = section.recipes.filter((r) => viewedIds.has(r.id)).length;
      return Math.round((completed / section.recipes.length) * 100);
    };

    return { completedModules, inProgressModules, getModuleProgress };
  }, [sections, viewedIds]);
};
