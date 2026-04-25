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

export interface RelatedRecipesResult {
  family: ExclusivePost[];
  similar: ExclusivePost[];
}

export function useRelatedRecipes(recipe: ExclusivePost | undefined) {
  return useQuery({
    queryKey: ['related-recipes', recipe?.id],
    enabled: !!recipe?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RelatedRecipesResult> => {
      if (!recipe) return { family: [], similar: [] };

      const { data, error } = await supabase
        .from('exclusive_posts')
        .select('*')
        .eq('is_published', true)
        .neq('id', recipe.id);

      if (error) throw error;

      const all = (data || []) as ExclusivePost[];

      // FAMILY: matching name token (e.g. "Caipirinha", "Mojito")
      const familyTokens = getFamilyTokens(recipe.title);
      const family: ExclusivePost[] = [];
      if (familyTokens.length > 0) {
        for (const post of all) {
          const postTokens = new Set(getFamilyTokens(post.title));
          if (familyTokens.some((t) => postTokens.has(t))) {
            family.push(post);
          }
        }
      }
      const familyIds = new Set(family.map((p) => p.id));

      // SIMILAR: Jaccard >= 50% nas chaves de ingredientes
      const baseKeys = ingredientKeys(recipe.ingredients);
      const similar: Array<{ post: ExclusivePost; score: number }> = [];
      if (baseKeys.size > 0) {
        for (const post of all) {
          if (familyIds.has(post.id)) continue;
          const postKeys = ingredientKeys(post.ingredients);
          if (postKeys.size === 0) continue;

          let intersection = 0;
          for (const k of postKeys) {
            if (baseKeys.has(k)) intersection++;
          }
          const union = baseKeys.size + postKeys.size - intersection;
          const jaccard = union > 0 ? intersection / union : 0;
          if (jaccard >= 0.5 && intersection >= 2) {
            similar.push({ post, score: jaccard });
          }
        }
      }
      similar.sort((a, b) => b.score - a.score);

      return { family, similar: similar.map((s) => s.post) };
    },
  });
}
