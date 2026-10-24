export type ShoppingRecipe = { id: string; name: string; image?: string | null; ingredients: string[];
  instructions?: string | null; yield?: number | null };
export type ShoppingItem = { name: string; quantity: number | null; unit: string; notes: string[];
  measures: Record<string, number>; missing: string[]; estimated: boolean; optional?: boolean };
export type ShoppingPlan = { name: string; people: number; perPerson: number; total: number;
  recipes: (ShoppingRecipe & { portions: number })[]; items: ShoppingItem[]; warnings: string[] };
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bde\b/g, '').replace(/\bgim\b/g, 'gin').replace(/\btahiti\b/g, 'taiti').replace(/\blimoes\b/g, 'limao').replace(/\s+/g, ' ').trim();
const number = (s: string) => s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s.replace(',', '.'));
const units: Record<string, [string, number]> = {
  ml: ['ml', 1], mililitros: ['ml', 1], l: ['ml', 1000], litro: ['ml', 1000], litros: ['ml', 1000],
  g: ['g', 1], gramas: ['g', 1], kg: ['g', 1000], quilo: ['g', 1000], quilos: ['g', 1000],
  dose: ['ml', 50], doses: ['ml', 50], unidade: ['unidade(s)', 1], unidades: ['unidade(s)', 1],
  gota: ['gota(s)', 1], gotas: ['gota(s)', 1], folha: ['folha(s)', 1], folhas: ['folha(s)', 1],
  rodela: ['rodela(s)', 1], rodelas: ['rodela(s)', 1], fatia: ['fatia(s)', 1], fatias: ['fatia(s)', 1],
  pedaco: ['pedaço(s)', 1], pedacos: ['pedaço(s)', 1], shot: ['ml', 40], shots: ['ml', 40],
  copo: ['ml', 200], copos: ['ml', 200], xicara: ['ml', 240], xicaras: ['ml', 240],
  'colher de sopa': ['ml', 15], 'colheres de sopa': ['ml', 15], 'colher de cha': ['ml', 5], 'colheres de cha': ['ml', 5],
};
const amountPattern = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)';
const unitPattern = Object.keys(units).sort((a, b) => b.length - a.length).join('|');
function measure(text: string, ingredient = '') {
  const clean = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/^[-•]\s*/, '')
    .replace(/^(?:adicione|adicionar|coloque|colocar|acrescente|junte|decore com)\s+/, '').replace(/^(?:suco|casca) de\s+/, '')
    .replace(/\bmei[ao]\b/g, '1/2').replace(/^uma?\s+/, '1 ');
  const match = clean.match(new RegExp(`^(${amountPattern})\\s*(${unitPattern})\\b(?:\\s+e\\s+(${amountPattern}))?\\s*(?:d[ae]\\s+)?(.+)$`));
  if (!match) {
    const bare = clean.match(new RegExp(`^(${amountPattern})\\s*(?:de\\s+)?(.+)$`));
    const name = normalize(ingredient);
    if (bare && ingredient && ingredientMatches(bare[2], ingredient)) {
      const liquid = /\b(xarope|licor|cachaca|gin|rum|vodka|tequila|whisky|whiskey)\b/.test(name);
      const fruit = /\b(limao|laranja|pepino|maca|abacaxi|cereja|maracuja)\b/.test(name);
      if (liquid || fruit) return { amount: number(bare[1]) * (liquid ? 50 : 1), unit: liquid ? 'ml' : 'unidade(s)', name: ingredient, estimated: false };
    }
    if (ingredient && /^(complete|completa|completar)\b/.test(clean) && ingredientMatches(clean, ingredient)) return { amount: 100, unit: 'ml', name: ingredient, estimated: true };
    return null;
  }
  const parts = match[1].split(/\s+/); const amount = parts.reduce((sum, part) => sum + number(part), 0);
  const unit = units[match[2].toLowerCase()];
  return unit && Number.isFinite(amount) && amount > 0 ? { amount: (amount + (match[3] ? number(match[3]) : 0)) * unit[1], unit: unit[0], name: match[4].trim(), estimated: false } : null;
}
function ingredientMatches(text: string, ingredient: string) {
  const value = normalize(text), name = normalize(ingredient);
  return (' ' + value + ' ').includes(' ' + name + ' ') || (name === 'energetico' && /\b(redbull|red bull|monster)\b/.test(value))
    || (name.startsWith('tequila ') && /\btequila\b/.test(value) && !/\b(ouro|prata|blanco|reposado|anejo)\b/.test(value))
    || (name.startsWith('limao ') && /\blimao\b/.test(value) && !/\b(siciliano|taiti)\b/.test(value));
}
function fallbackMeasure(ingredient: string) {
  const name = normalize(ingredient);
  if (/xarope|licor|leite condensado/.test(name)) return { amount: 25, unit: 'ml', estimated: true };
  if (/\b(cachaca|gin|rum|vodka|tequila|whisky|whiskey|cafe|leite|creme)\b/.test(name)) return { amount: 50, unit: 'ml', estimated: true };
  if (/suco|agua|energetico|refrigerante|soda|cerveja|espumante|vinho/.test(name)) return { amount: 100, unit: 'ml', estimated: true };
  if (/acucar|sal/.test(name)) return { amount: name === 'sal' ? 1 : 10, unit: 'g', estimated: true };
  if (/hortela|manjericao/.test(name)) return { amount: 4, unit: 'folha(s)', estimated: true };
  if (/limao|laranja/.test(name)) return { amount: .5, unit: 'unidade(s)', estimated: true };
  if (/abacaxi|melancia|melao/.test(name)) return { amount: 1, unit: 'fatia(s)', estimated: true };
  if (/pepino|gengibre/.test(name)) return { amount: 2, unit: 'rodela(s)', estimated: true };
  if (/bitters?|angostura/.test(name)) return { amount: 2, unit: 'gota(s)', estimated: true };
  return { amount: 1, unit: 'unidade(s)', estimated: true };
}
const decorationLine = (line: string) => /\b(decor|decore|decorar|decoracao|guarnicao|enfeite|borda)\b/.test(normalize(line))
  || /\b(decoracao|decorar|decorativa|decorativas)\b/.test(normalize(line));
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
    if (!knownYield) warnings.push(`${recipe.name}: rendimento estimado em 1 drink, pois não foi informado.`);
    const seenIngredients = new Set<string>();
    for (const ingredient of recipe.ingredients) {
      if (seenIngredients.has(normalize(ingredient))) continue;
      seenIngredients.add(normalize(ingredient));
      if (!ingredient.trim() || normalize(ingredient).startsWith('gelo')) continue;
      const preparation = (recipe.instructions || '').split(/\r?\n/);
      const mentioned = preparation.filter(line => ingredientMatches(line, ingredient));
      const optional = mentioned.length > 0 && mentioned.every(decorationLine);
      const ingredientLines = optional ? preparation.filter(decorationLine) : preparation.filter(line => !decorationLine(line));
      let parsed = measure(ingredient);
      if (!parsed) {
        const multipleLimes = recipe.ingredients.filter(i => normalize(i).startsWith('limao')).length > 1;
        const matches = ingredientLines
          .filter(line => !multipleLimes || !normalize(ingredient).startsWith('limao ') || normalize(line).includes(normalize(ingredient)))
          .filter(line => !recipe.ingredients.some(other => normalize(other).length > normalize(ingredient).length && normalize(line).includes(normalize(other))))
          .map(line => measure(line, ingredient)).filter(p => p && ingredientMatches(p.name, ingredient)
            && !recipe.ingredients.some(other => normalize(other).length > normalize(ingredient).length && normalize(p.name).includes(normalize(other))));
        if (matches.length === 1) parsed = matches[0];
        else if (matches.length > 1 && new Set(matches.map(m => m!.unit)).size === 1) parsed = { ...matches[0]!, amount: matches.reduce((sum, m) => sum + m!.amount, 0), estimated: matches.some(m => m!.estimated) };
      }
      if (!parsed) {
        const fallback = optional ? { amount: 1, unit: /limao|laranja|pepino/.test(normalize(ingredient)) ? 'rodela(s)' : /hortela|manjericao/.test(normalize(ingredient)) ? 'folha(s)' : 'unidade(s)', estimated: true } : fallbackMeasure(ingredient);
        parsed = { ...fallback, name: ingredient };
        warnings.push(`${recipe.name} - ${ingredient}: referência estimada de ${fallback.amount.toLocaleString('pt-BR')} ${fallback.unit} por drink${optional ? ', decoração opcional' : ''}.`);
      }
      const parsedName = measure(ingredient)?.name;
      const label = parsedName ? parsedName.charAt(0).toLocaleUpperCase('pt-BR') + parsedName.slice(1) : ingredient.trim();
      const quantified = parsed;
      const key = normalize(label);
      const previous = items.get(key);
      const item = items.get(key) || { name: label, quantity: null, unit: '', notes: [], measures: {}, missing: [], estimated: false, optional };
      const omitDecoration = optional && previous?.optional === false;
      if (previous?.optional === true && !optional) { item.measures = {}; item.estimated = false; }
      item.optional = item.optional === true && optional;
      if (quantified && !omitDecoration) {
        item.measures[parsed.unit] = (item.measures[parsed.unit] || 0) + parsed.amount * recipe.portions / (parsed.estimated ? 1 : knownYield ? recipe.yield! : 1);
        item.estimated ||= parsed.estimated || !knownYield;
      } else if (!quantified && !item.missing.includes(recipe.name)) item.missing.push(recipe.name);
      const measures = Object.entries(item.measures); item.quantity = measures.length === 1 ? measures[0][1] : null; item.unit = measures.length === 1 ? measures[0][0] : '';
      if (!item.notes.includes(recipe.name)) item.notes.push(recipe.name);
      items.set(key, item);
    }
  }
  items.set('gelo', { name: 'Gelo', quantity: total * 300, unit: 'g', measures: { g: total * 300 }, notes: [], missing: [], estimated: true });
  return { name, people, perPerson, total, recipes: selected, items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), warnings };
}
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
export function shoppingQuantity(item: ShoppingItem) {
  const name = normalize(item.name), ml = item.measures.ml;
  if (name === 'gelo') {
    const kg = item.measures.g / 1000, bags = Math.ceil(kg / 3);
    return `${bags} saco(s) de 3 kg (${bags * 3} kg no total). Base estimada: ${fmt(kg)} kg.`;
  }
  if (ml && Object.keys(item.measures).length === 1) {
    let pack = 0, type = '';
    if (/\b(cachaca|gin|rum|vodka|tequila|whisky|whiskey|licor|campari|aperol|vermute)\b/.test(name)) { pack = 750; type = 'garrafa(s)'; }
    else if (name.includes('energetico')) { pack = /mango loko|monster/.test(name) ? 473 : 250; type = 'lata(s)'; }
    else if (/tonica|refrigerante|soda/.test(name)) { pack = 350; type = 'lata(s)'; }
    else if (name.includes('xarope')) { pack = 500; type = 'frasco(s)'; }
    return `${pack ? `${Math.ceil(ml / pack)} ${type} de ${pack} ml. ` : ''}Necessário: ${fmt(ml)} ml${item.estimated ? ' (estimativa)' : ''}.`;
  }
  if (item.unit === 'unidade(s)' && item.quantity != null) return 'Comprar ' + Math.ceil(item.quantity) + ' unidade(s). Necessário: ' + fmt(item.quantity) + (item.estimated ? ' (estimativa).' : '.');
  if (/^limao|^laranja/.test(name) && item.unit === 'rodela(s)' && item.quantity != null) return 'Comprar ' + Math.ceil(item.quantity / 8) + ' unidade(s). Estimativa: 8 rodelas por fruta; necessário: ' + fmt(item.quantity) + ' rodelas.';
  if (name === 'pepino' && item.unit === 'rodela(s)' && item.quantity != null) return 'Comprar ' + Math.ceil(item.quantity / 12) + ' pepino(s). Estimativa: 12 rodelas por unidade; necessário: ' + fmt(item.quantity) + ' rodelas.';
  return Object.entries(item.measures).map(([unit, amount]) => `${fmt(amount)} ${unit}`).join(' + ') + (item.estimated ? ' (estimativa)' : '');
}
export function requireCompleteShoppingPlan(plan: ShoppingPlan) {
  const missing = plan.items.filter(item => item.missing.length > 0);
  if (missing.length || !plan.items.length || plan.recipes.some(recipe => recipe.portions > 0 && !recipe.ingredients.length)) {
    const details = missing.map(item => item.name + ' (' + item.missing.join(', ') + ')').join('; ');
    throw new Error('Faltam medidas ou rendimentos no cadastro: ' + (details || plan.warnings.join(' ')) + '. Corrija as receitas para gerar uma lista completa.');
  }
}
