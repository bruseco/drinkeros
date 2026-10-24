import { jsPDF } from 'jspdf';
import { shoppingQuantity, type ShoppingPlan } from './shoppingPlan';

export function createShoppingPdf(plan: ShoppingPlan, images: Record<string, string> = {}, logo?: string) {
  const doc = new jsPDF({ unit: 'mm', format: [110, 220] });
  const width = 110, height = 220, margin = 9; let y = 12;
  const background = () => { doc.setFillColor(12, 12, 12); doc.rect(0, 0, width, height, 'F'); };
  background();
  const room = (space: number) => { if (y + space > height - 13) { doc.addPage(); background(); y = 13; } };
  const write = (text: string, size = 11, color = '#eeeeee', gap = 3) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines: string[] = doc.splitTextToSize(text, width - margin * 2);
    for (const line of lines) { room(size * .44); doc.text(line, margin, y); y += size * .44; }
    y += gap;
  };
  const heading = (text: string) => { room(27); y += 5; write(text, 23, '#ff8a31', 6); };
  const image = (data: string, x: number, top: number, w: number, h: number) => {
    const props = doc.getImageProperties(data); const ratio = Math.min(w / props.width, h / props.height);
    const iw = props.width * ratio, ih = props.height * ratio;
    doc.addImage(data, x + (w - iw) / 2, top + (h - ih) / 2, iw, ih);
  };
  if (logo) { image(logo, 37, y, 36, 15); y += 23; }
  else { write('DRINKEROS', 12, '#ff8a31', 7); }
  write(plan.name, 25, '#ffffff', 6);
  write(`${plan.people} pessoas | ${plan.perPerson} drinks por pessoa`, 11);
  write(`${plan.total} porções no total`, 11, '#cccccc', 4);
  write('Estimativa de compra. Porções distribuídas entre os drinks selecionados.', 9, '#aaaaaa');
  heading('Lista de compras');
  if (!plan.items.length) write('Ingredientes não cadastrados. Consulte as receitas.', 11);
  for (const item of plan.items) {
    room(19); doc.setDrawColor('#aaaaaa'); doc.rect(margin, y - 3, 3, 3);
    write(`     ${item.name}`, 12, '#ffffff', 1);
    write(shoppingQuantity(item), 10, item.quantity == null ? '#ffb877' : '#cccccc', 5);
  }
  if (plan.warnings.length) { heading('Confira antes de comprar'); for (const warning of plan.warnings) write(warning, 10, '#ffb877'); }
  write('Medidas como doses e unidades foram mantidas como na receita. Itens sem medida não foram estimados. Confira gelo, decoração e utensílios.', 9, '#aaaaaa');
  doc.addPage(); background(); y = 13; heading('Drinks selecionados');
  for (let i = 0; i < plan.recipes.length; i += 2) {
    const row = plan.recipes.slice(i, i + 2); doc.setFontSize(11);
    const titles = row.map(r => {
      const lines = doc.splitTextToSize(r.name, 42) as string[];
      return lines.length > 7 ? [...lines.slice(0, 6), `${lines[6].slice(0, -3)}...`] : lines;
    });
    const lineCounts = titles.map(lines => lines.length);
    const rowHeight = 40 + Math.max(...lineCounts) * 5 + 10;
    room(rowHeight);
    for (let col = 0; col < row.length; col++) {
      const recipe = row[col], x = margin + col * 48;
      if (images[recipe.id]) image(images[recipe.id], x, y, 42, 32);
      else { doc.setFillColor(32, 32, 32); doc.roundedRect(x, y, 42, 32, 2, 2, 'F'); }
      doc.setFontSize(11); doc.setTextColor('#ffffff');
      doc.text(titles[col], x, y + 39);
      doc.setFontSize(10); doc.setTextColor('#ff8a31'); doc.text(`${recipe.portions} porções`, x, y + 39 + lineCounts[col] * 5);
    }
    y += rowHeight;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor('#888888'); doc.text(`Drinkeros | ${page}/${doc.getNumberOfPages()}`, margin, height - 5);
  }
  return doc;
}

export async function shoppingImage(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return;
    const blob = await response.blob(); if (!blob.type.startsWith('image/')) return;
    const bitmap = await createImageBitmap(blob); const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 500 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d'); if (!ctx) { bitmap.close(); return; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); return canvas.toDataURL('image/png');
  } catch { return; }
}
