import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ExclusivePost } from './useExclusivePosts';

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'a', 'o', 'as', 'os',
  'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'um', 'uma',
]);

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFamilyTokens(title: string): string[] {
  return normalize(title)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

const ING_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'a', 'o', 'as', 'os',
  'em', 'no', 'na', 'para', 'por', 'um', 'uma', 'ml', 'g', 'kg', 'l',
  'gelo', 'cubos', 'cubo', 'pedras', 'pedra', 'gosto', 'qb',
  'colher', 'colheres', 'xicara', 'xicaras', 'dose', 'doses',
]);

/**
 * Reduz um ingrediente à(s) sua(s) palavra(s)-chave principais.
 * Ex: "50ml de Gin Tanqueray" -> "gin tanqueray" -> token "gin"
 */
function ingredientKey(ing: string): string | null {
  const tokens = normalize(ing)
    .split(' ')
    .filter((w) => w.length >= 3 && !ING_STOPWORDS.has(w) && !/^\d+$/.test(w));
  if (tokens.length === 0) return null;
  // usa a primeira palavra significativa como chave (geralmente o nome do ingrediente)
  return tokens[0];
}

function ingredientKeys(ings: string[] | null | undefined): Set<string> {
  const set = new Set<string>();
  for (const i of ings || []) {
    const k = ingredientKey(i);
    if (k) set.add(k);
  }
  return set;
}

function isXarope(post: Pick<ExclusivePost, 'title' | 'characteristics'>): boolean {
  const t = normalize(post.title);
  if (t.includes('xarope')) return true;
  for (const c of post.characteristics || []) {
    if (normalize(c).includes('xarope')) return true;
  }
  return false;
}

export interface RelatedRecipesResult {
  family: ExclusivePost[];
  similar: ExclusivePost[];
  otherSyrups: ExclusivePost[];
  isSyrup: boolean;
}

export function useRelatedRecipes(recipe: ExclusivePost | undefined) {
  return useQuery({
    queryKey: ['related-recipes', recipe?.id],
    enabled: !!recipe?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RelatedRecipesResult> => {
      if (!recipe) return { family: [], similar: [], otherSyrups: [], isSyrup: false };

      const { data, error } = await supabase
        .from('exclusive_posts')
        .select('*')
        .eq('is_published', true)
        .neq('id', recipe.id);

      if (error) throw error;

      const all = (data || []) as ExclusivePost[];
      const recipeIsSyrup = isXarope(recipe);

      // If current recipe is a syrup, only return other syrups
      if (recipeIsSyrup) {
        const otherSyrups = all.filter((p) => isXarope(p));
        return { family: [], similar: [], otherSyrups, isSyrup: true };
      }

      // Exclude syrups from candidate pool for non-syrup recipes
      const candidates = all.filter((p) => !isXarope(p));

      // FAMILY: matching name token (e.g. "Caipirinha", "Mojito")
      const familyTokens = getFamilyTokens(recipe.title);
      const family: ExclusivePost[] = [];
      if (familyTokens.length > 0) {
        for (const post of candidates) {
          const postTokens = new Set(getFamilyTokens(post.title));
          if (familyTokens.some((t) => postTokens.has(t))) {
            family.push(post);
          }
        }
      }
      const familyIds = new Set(family.map((p) => p.id));

      // SIMILAR: drinks que compartilham características (tags) com o atual
      const baseChars = new Set(
        (recipe.characteristics || []).map((c) => normalize(c)).filter(Boolean)
      );
      const similar: Array<{ post: ExclusivePost; score: number }> = [];
      if (baseChars.size > 0) {
        for (const post of candidates) {
          if (familyIds.has(post.id)) continue;
          const postChars = new Set(
            (post.characteristics || []).map((c) => normalize(c)).filter(Boolean)
          );
          if (postChars.size === 0) continue;

          let intersection = 0;
          for (const c of postChars) {
            if (baseChars.has(c)) intersection++;
          }
          if (intersection >= 1) {
            similar.push({ post, score: intersection });
          }
        }
      }
      similar.sort((a, b) => b.score - a.score);

      return {
        family,
        similar: similar.map((s) => s.post),
        otherSyrups: [],
        isSyrup: false,
      };
    },
  });
}
