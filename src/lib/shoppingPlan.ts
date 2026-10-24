export type ShoppingRecipe = { id: string; name: string; image?: string | null; ingredients: string[];
  instructions?: string | null; yield?: number | null };
export type ShoppingItem = { name: string; quantity: number | null; unit: string; notes: string[] };
export type ShoppingPlan = { name: string; people: number; perPerson: number; total: number;
  recipes: (ShoppingRecipe & { portions: number })[]; items: ShoppingItem[]; warnings: string[] };
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (s: string) => s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s.replace(',', '.'));
const units: Record<string, [string, number]> = {
  ml: ['ml', 1], mililitros: ['ml', 1], l: ['ml', 1000], litro: ['ml', 1000], litros: ['ml', 1000],
  g: ['g', 1], gramas: ['g', 1], kg: ['g', 1000], quilo: ['g', 1000], quilos: ['g', 1000],
  dose: ['dose(s)', 1], doses: ['dose(s)', 1], unidade: ['unidade(s)', 1], unidades: ['unidade(s)', 1],
  gota: ['gota(s)', 1], gotas: ['gota(s)', 1], folha: ['folha(s)', 1], folhas: ['folha(s)', 1],
};
function measure(text: string) {
  // Explicit quantities only; mixed fractions are parsed together, never as their first digit.
  const match = text.trim().replace(/^[-•]\s*/, '').match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(ml|mililitros|litros?|l|gramas|g|kg|quilos?|doses?|unidades?|gotas?|folhas?)\b\s*(?:de\s+)?(.+)$/i);
  if (!match || /\b(?:e\s+\d|a gosto|aproximad)/i.test(match[3])) return null;
  const parts = match[1].split(/\s+/); const amount = parts.reduce((sum, part) => sum + number(part), 0);
  const unit = units[match[2].toLowerCase()];
  return unit && Number.isFinite(amount) && amount > 0 ? { amount: amount * unit[1], unit: unit[0], name: match[3].trim() } : null;
}
export function makeShoppingPlan(name: string, recipes: ShoppingRecipe[], people: number, perPerson: number): ShoppingPlan {
  if (!Number.isInteger(people) || people < 1 || people > 1000 || !Number.isInteger(perPerson) || perPerson < 1 || perPerson > 20) throw new Error('Informe números válidos de pessoas e drinks.');
  if (!recipes.length) throw new Error('A lista não tem receitas disponíveis.');
  const total = people * perPerson;
  const selected = recipes.map((recipe, index) => ({ ...recipe, portions: Math.floor(total / recipes.length) + (index < total % recipes.length ? 1 : 0) }));
  const items = new Map<string, ShoppingItem>(); const warnings: string[] = [];
  for (const recipe of selected) {
    if (!recipe.portions) continue;
    if (!recipe.ingredients.length) warnings.push(`${recipe.name}: ingredientes não cadastrados. Confira a receita.`);
    const knownYield = recipe.yield != null && recipe.yield > 0;
    if (!knownYield) warnings.push(`${recipe.name}: rendimento não informado; confira as quantidades na receita.`);
    for (const ingredient of recipe.ingredients) {
      let parsed = measure(ingredient);
      if (!parsed) {
        const matches = (recipe.instructions || '').split(/\r?\n/).map(measure).filter(p => p && normalize(p.name).includes(normalize(ingredient)));
        // Ambiguous or repeated instruction lines require checking, not guessing.
        if (matches.length === 1) parsed = matches[0];
      }
      const label = measure(ingredient)?.name || ingredient.trim();
      const quantified = knownYield && parsed;
      const key = `${normalize(label)}|${quantified ? parsed.unit : 'check'}`;
      const item = items.get(key) || { name: label, quantity: quantified ? 0 : null, unit: quantified ? parsed.unit : '', notes: [] };
      if (quantified) item.quantity! += parsed.amount * recipe.portions / recipe.yield!;
      if (!item.notes.includes(recipe.name)) item.notes.push(recipe.name);
      items.set(key, item);
    }
  }
  return { name, people, perPerson, total, recipes: selected, items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), warnings };
}
export const shoppingQuantity = (item: ShoppingItem) => item.quantity == null ? 'Quantidade a conferir' : `${item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${item.unit}`;
