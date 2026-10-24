import { expect, it } from 'vitest';
import { makeShoppingPlan, type ShoppingRecipe } from './shoppingPlan';
const recipe = (id: string, ingredients: string[], extra = {}): ShoppingRecipe => ({ id, name: id, ingredients, yield: 1, ...extra });
it('distributes exactly the requested total, including indivisible totals', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', []), recipe('B', [])], 5, 3);
  expect(p.recipes.map(r => r.portions)).toEqual([8, 7]); expect(p.total).toBe(15);
});
it('scales by recipe yield and merges compatible units, retaining incompatible measures', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['50 ml de Rum'], { yield: 2 }), recipe('B', ['0,1 l de rum', '1 dose de Rum'])], 2, 2);
  expect(p.items.find(i => i.unit === 'ml')?.quantity).toBe(250);
  expect(p.items.find(i => i.unit === 'dose(s)')?.quantity).toBe(2);
});
it('recognizes explicit fractional measures in preparation instructions', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Rum'], { instructions: '1 1/2 dose de Rum' })], 2, 1);
  expect(p.items[0].quantity).toBe(3);
});
it('never invents missing quantities or yields', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Rum', 'gelo']), recipe('B', ['50 ml de Rum'], { yield: null })], 2, 1);
  expect(p.items.every(i => i.quantity === null)).toBe(true); expect(p.warnings).toHaveLength(1);
});
it('flags ambiguous preparation measures rather than counting one arbitrarily', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['Rum'], { instructions: '1 dose de Rum\n2 doses de Rum' })], 2, 1);
  expect(p.items[0].quantity).toBeNull();
});
it('excludes ingredients of recipes allocated zero servings', () => {
  const p = makeShoppingPlan('Festa', [recipe('A', ['50 ml de Rum']), recipe('B', ['50 ml de Vodka'])], 1, 1);
  expect(p.items).toHaveLength(1); expect(p.items[0].name).toBe('Rum');
});
it('rejects invalid numbers and empty lists', () => {
  for (const n of [0, -1, 1.5, NaN, 1001]) expect(() => makeShoppingPlan('x', [recipe('A', [])], n, 3)).toThrow();
  expect(() => makeShoppingPlan('x', [], 5, 3)).toThrow();
});
