import { expect, it } from 'vitest';
import { makeShoppingPlan, requireCompleteShoppingPlan, shoppingQuantity, type ShoppingRecipe } from './shoppingPlan';
const recipe = (id: string, ingredients: string[], extra = {}): ShoppingRecipe => ({ id, name: id, ingredients, yield: 1, ...extra });
it('distributes exactly the requested total, including indivisible totals', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', []), recipe('B', [])], 5, 3);
  expect(p.recipes.map(r => r.portions)).toEqual([8, 7]); expect(p.total).toBe(15);
});
it('scales by recipe yield and merges compatible units, retaining incompatible measures', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['50 ml de Rum'], { yield: 2 }), recipe('B', ['0,1 l de rum', '1 dose de Rum'])], 2, 2);
  expect(p.items.find(i => i.name === 'Rum')?.quantity).toBe(350);
  expect(p.items.filter(i => i.name.toLowerCase() === 'rum')).toHaveLength(1);
});
it('recognizes explicit fractional measures in preparation instructions', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Rum'], { instructions: '1 1/2 dose de Rum' })], 2, 1);
  expect(p.items.find(i => i.name === 'Rum')?.quantity).toBe(150);
});
it('never invents missing quantities or yields', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Rum', 'gelo']), recipe('B', ['50 ml de Rum'], { yield: null })], 2, 1);
  expect(p.items.filter(i => i.name !== 'Gelo').every(i => i.quantity === null)).toBe(true); expect(p.warnings).toHaveLength(1);
});
it('flags ambiguous preparation measures rather than counting one arbitrarily', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Rum'], { instructions: '1 dose de Rum\n2 doses de Rum' })], 2, 1);
  expect(p.items.find(i => i.name === 'Rum')?.quantity).toBeNull();
});
it('excludes ingredients of recipes allocated zero servings', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['50 ml de Rum']), recipe('B', ['50 ml de Vodka'])], 1, 1);
  expect(p.items.filter(i => i.name !== 'Gelo')).toHaveLength(1); expect(p.items.some(i => i.name === 'Rum')).toBe(true);
});
it('rejects invalid numbers and empty lists', () => {
  for (const n of [0, -1, 1.5, NaN, 1001]) expect(() => makeShoppingPlan('x', [recipe('A', [])], n, 3)).toThrow();
  expect(() => makeShoppingPlan('x', [], 5, 3)).toThrow();
});
it('reads spoken halves, additive fractions, prep prefixes and citrus counts', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Xarope de Gengibre', 'Cachaça', 'Limão Taiti'], {
    instructions: 'Adicione meia dose de xarope de gengibre\n2 doses e 1/2 de cachaça\nSuco de meio limão taiti',
  })], 2, 1);
  expect(p.items.find(i => i.name === 'Xarope de Gengibre')?.quantity).toBe(50);
  expect(p.items.find(i => i.name === 'Cachaça')?.quantity).toBe(250);
  expect(p.items.find(i => i.name === 'Limão Taiti')?.quantity).toBe(1);
  expect(() => requireCompleteShoppingPlan(p)).not.toThrow();
});
it('uses approved top-up and ice estimates and rounds purchases up to full packages', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Gin', 'Energético'], { instructions: '1 dose de gin\nComplete com energético' })], 5, 3);
  const gin = p.items.find(i => i.name === 'Gin')!, energy = p.items.find(i => i.name === 'Energético')!, ice = p.items.find(i => i.name === 'Gelo')!;
  expect(gin.quantity).toBe(750); expect(shoppingQuantity(gin)).toContain('1 garrafa(s) de 750 ml');
  expect(energy.quantity).toBe(1500); expect(energy.estimated).toBe(true); expect(shoppingQuantity(energy)).toContain('6 lata(s) de 250 ml');
  expect(ice.quantity).toBe(4500); expect(shoppingQuantity(ice)).toContain('2 saco(s) de 3 kg');
});
it('has one ingredient row even when some recipes still lack a measure', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Xarope de Gengibre'], { instructions: '1/2 dose de xarope de gengibre' }), recipe('B', ['Xarope de Gengibre'])], 2, 1);
  expect(p.items.filter(i => i.name === 'Xarope de Gengibre')).toHaveLength(1);
  expect(() => requireCompleteShoppingPlan(p)).toThrow(/Xarope de Gengibre.*B/);
});
it('does not assign a generic lime measure to both named varieties', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Limão Siciliano', 'Limão Taiti'], { instructions: 'Suco de 1 limão' })], 1, 1);
  expect(() => requireCompleteShoppingPlan(p)).toThrow();
});
it('applies the top-up reference per final drink rather than per recipe batch', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Energético'], { yield: 4, instructions: 'Complete com energético' })], 3, 1);
  expect(p.items.find(i => i.name === 'Energético')?.quantity).toBe(300);
});
it('does not double count identical ingredient entries or confuse gin with ginger', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Gin', 'gin'], { instructions: '1 dose de Gin' })], 1, 1);
  expect(p.items.find(i => i.name === 'Gin')?.quantity).toBe(50);
  const other = makeShoppingPlan('Festa', [recipe('A', ['Gin'], { instructions: '1 dose de ginger beer' })], 1, 1);
  expect(() => requireCompleteShoppingPlan(other)).toThrow();
});
