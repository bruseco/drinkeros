import { writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { makeShoppingPlan } from './shoppingPlan';
import { createShoppingPdf } from './shoppingPdf';
it('paginates a mobile shopping document with long names and missing measures', async () => {
  const plan = makeShoppingPlan('Churrasco de sábado', Array.from({ length: 9 }, (_, i) => ({ id: String(i), name: `Drink especial ${i + 1} com maracujá e especiarias`, ingredients: ['50 ml de Rum', 'Gelo a gosto', `${i + 1} unidades de Limão Taiti`], yield: 1 })), 15, 3);
  const pdf = createShoppingPdf(plan); expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(110);
  if (process.env.DRINKEROS_PDF_PREVIEW) await writeFile(process.env.DRINKEROS_PDF_PREVIEW, Buffer.from(pdf.output('arraybuffer')));
});
