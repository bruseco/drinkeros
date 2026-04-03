export interface ParsedRecipeCsvRow {
  title: string;
  youtubeUrl: string | null;
  coverUrl: string | null;
  ingredients: string[];
  instructions: string | null;
  characteristics: string[];
}

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const cleanText = (value: string) =>
  decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const stripHtml = (value: string) => cleanText(value.replace(/<[^>]*>/g, ' '));

const normalizeInstructions = (value?: string) => {
  if (!value) return null;

  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const listItems = [...normalized.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);

  if (listItems.length > 0) {
    return listItems.join('\n');
  }

  return cleanText(
    normalized
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|ol|ul)>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  ) || null;
};

const parseTagList = (value?: string) => {
  if (!value) return [];

  return value
    .split(/[;,\n]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
};

const detectDelimiter = (headerLine: string) => {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
};

const parseDelimitedText = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = '';
  };

  const pushRow = () => {
    if (currentRow.some((cell) => cell.trim() !== '') || currentValue.trim() !== '') {
      pushValue();
      rows.push(currentRow);
    }
    currentRow = [];
    currentValue = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      pushValue();
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      pushRow();
      continue;
    }

    currentValue += char;
  }

  if (currentRow.length > 0 || currentValue.trim() !== '') {
    pushRow();
  }

  return rows;
};

const findColumnIndex = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.some((alias) => header.includes(alias)));
};

export const parseRecipeCsv = (text: string): ParsedRecipeCsvRow[] => {
  const normalizedText = text.replace(/^\uFEFF/, '').trim();
  if (!normalizedText) return [];

  const firstLine = normalizedText.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseDelimitedText(normalizedText, delimiter);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const titleIndex = findColumnIndex(headers, ['titulo', 'title']);
  const youtubeIndex = findColumnIndex(headers, ['link do youtube', 'youtube', 'video']);
  const coverIndex = findColumnIndex(headers, ['capa', 'cover', 'image']);
  const ingredientsIndex = findColumnIndex(headers, ['ingredientes', 'ingrediente', 'ingredients', 'ingredient']);
  const instructionsIndex = findColumnIndex(headers, ['modo de preparo', 'preparo', 'instructions', 'instruction', 'modo']);
  const characteristicsIndex = findColumnIndex(headers, ['caracteristicas', 'characteristics', 'characteristic']);

  if (titleIndex === -1) {
    throw new Error('Coluna "Título" não encontrada no CSV');
  }

  return rows
    .slice(1)
    .map((row) => ({
      title: cleanText(row[titleIndex] ?? ''),
      youtubeUrl: cleanText(row[youtubeIndex] ?? '') || null,
      coverUrl: cleanText(row[coverIndex] ?? '') || null,
      ingredients: parseTagList(row[ingredientsIndex] ?? ''),
      instructions: normalizeInstructions(row[instructionsIndex] ?? ''),
      characteristics: parseTagList(row[characteristicsIndex] ?? ''),
    }))
    .filter((row) => row.title);
};