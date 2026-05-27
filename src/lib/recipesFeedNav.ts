// Helpers to share the current recipe feed order between the listing page
// (UserRecipes) and the detail page (UserRecipeDetail) so the user can swipe
// left/right between drinks and return to the list at the same scroll position.

export interface RecipeFeedItem {
  id: string;
  slug: string | null;
}

const ORDER_KEY = 'user-recipes:order';
const SCROLL_KEY = 'user-recipes:scroll-to-key';

export const recipeRoute = (item: RecipeFeedItem) =>
  `/app/receita/${item.slug || item.id}`;

export const recipeKey = (item: RecipeFeedItem) => item.slug || item.id;

export function saveRecipeFeedOrder(items: RecipeFeedItem[]) {
  try {
    sessionStorage.setItem(
      ORDER_KEY,
      JSON.stringify(items.map((r) => ({ id: r.id, slug: r.slug || null })))
    );
  } catch {}
}

export function getRecipeFeedOrder(): RecipeFeedItem[] {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && typeof r === 'object' && r.id);
  } catch {
    return [];
  }
}

export function findRecipeIndex(items: RecipeFeedItem[], idOrSlug: string): number {
  if (!idOrSlug) return -1;
  return items.findIndex((r) => r.id === idOrSlug || r.slug === idOrSlug);
}

export function setRecipeScrollTarget(key: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY, key);
  } catch {}
}

export function consumeRecipeScrollTarget(): string | null {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY);
    if (v) sessionStorage.removeItem(SCROLL_KEY);
    return v;
  } catch {
    return null;
  }
}
