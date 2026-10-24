import { jsPDF } from 'jspdf';
import { requireCompleteShoppingPlan, shoppingQuantity, type ShoppingPlan } from './shoppingPlan';
import logoUrl from '@/assets/logotipo-drinkeros.png';

export function createShoppingPdf(plan: ShoppingPlan, images: Record<string, string> = {}, logo?: string, titleFont?: string) {
  requireCompleteShoppingPlan(plan);
  const doc = new jsPDF({ unit: 'mm', format: [110, 220] });
  if (titleFont) { doc.addFileToVFS('Montserrat-Light.ttf', titleFont); doc.addFont('Montserrat-Light.ttf', 'MontserratLight', 'normal'); }
  const width = 110, height = 220, margin = 9; let y = 12;
  const background = () => { doc.setFillColor(12, 12, 12); doc.rect(0, 0, width, height, 'F'); };
  background();
  const room = (space: number) => { if (y + space > height - 13) { doc.addPage(); background(); y = 13; } };
  const write = (text: string, size = 11, color = '#eeeeee', gap = 3) => {
    if (size >= 20) text = text.toLocaleUpperCase('pt-BR');
    doc.setFont(size >= 20 && titleFont ? 'MontserratLight' : 'helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
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
  const summary = (text: string, kind: 'people' | 'drink' | 'total') => {
    room(14); doc.setDrawColor('#ff8a31'); doc.setLineWidth(.4);
    if (kind === 'people') {
      doc.circle(margin + 1.5, y - 3, 1); doc.circle(margin + 4.5, y - 3, 1);
      doc.line(margin, y, margin + 3, y); doc.line(margin + 3, y, margin + 6, y);
      doc.line(margin, y, margin, y - 1); doc.line(margin + 6, y, margin + 6, y - 1);
    } else {
      doc.line(margin, y - 4, margin + 5, y - 4);
      doc.line(margin, y - 4, margin + 2.5, y - 1.5); doc.line(margin + 5, y - 4, margin + 2.5, y - 1.5);
      doc.line(margin + 2.5, y - 1.5, margin + 2.5, y + 1); doc.line(margin + 1, y + 1, margin + 4, y + 1);
      if (kind === 'total') doc.circle(margin + 5.5, y - 4.5, 1.5);
    }
    write('     ' + text, 16, '#eeeeee', 5);
  };
  summary(`${plan.people} pessoas`, 'people');
  summary(`${plan.perPerson} drinks por pessoa`, 'drink');
  summary(`${plan.total} drinks no total`, 'total');
  write('Estimativa de compra. O total de drinks é distribuído entre as receitas selecionadas.', 9, '#aaaaaa');
  heading('Lista de compras');
  if (!plan.items.length) write('Ingredientes não cadastrados. Consulte as receitas.', 11);
  for (const item of plan.items) {
    room(19); doc.setDrawColor('#ff8a31'); doc.setLineWidth(.5);
    doc.line(margin, y - 1.5, margin + 1, y - .5); doc.line(margin + 1, y - .5, margin + 3, y - 3);
    write(`     ${item.name}`, 12, '#ffffff', 1);
    write(shoppingQuantity(item), 10, item.quantity == null ? '#ffb877' : '#cccccc', 5);
  }
  if (plan.warnings.length) { heading('Confira antes de comprar'); for (const warning of plan.warnings) write(warning, 10, '#ffb877'); }
  write('Referências: dose de 50 ml; completar = 100 ml por drink (estimativa). Embalagens são referências de compra; escolha o tamanho indicado. Gelo: estimativa de 300 g por drink, em sacos de 3 kg.', 9, '#aaaaaa');
  doc.addPage(); background(); y = 13; heading('Drinks selecionados');
  for (let i = 0; i < plan.recipes.length; i += 2) {
    const row = plan.recipes.slice(i, i + 2); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
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
      doc.setFontSize(10); doc.setTextColor('#ff8a31'); doc.text(`${recipe.portions} drinks`, x, y + 39 + lineCounts[col] * 5);
    }
    y += rowHeight;
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor('#888888'); doc.text(`Drinkeros | ${page}/${doc.getNumberOfPages()}`, margin, height - 5);
  }
  return doc;
}

export async function shoppingTitleFont(): Promise<string> {
  const response = await fetch('/fonts/Montserrat-Light.ttf');
  if (!response.ok) throw new Error('Não foi possível carregar a fonte do PDF. Tente novamente.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

export async function downloadShoppingPdf(plan: ShoppingPlan) {
  const titleFont = await shoppingTitleFont();
  const images: Record<string, string> = {};
  for (let offset = 0; offset < plan.recipes.length; offset += 4) await Promise.all(plan.recipes.slice(offset, offset + 4).map(async r => {
    if (r.image) { const image = await shoppingImage(r.image); if (image) images[r.id] = image; }
  }));
  const logo = await shoppingImage(logoUrl);
  createShoppingPdf(plan, images, logo, titleFont).save('lista-de-compras-' + (plan.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'drinkeros') + '.pdf');
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
