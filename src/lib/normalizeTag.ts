/**
 * Normaliza uma tag para comparação: minúscula, sem acento, sem espaços extras.
 * Usado para detectar duplicidades e erros ortográficos leves.
 */
export const normalizeTag = (tag: string): string =>
  tag
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Distância de Levenshtein simples para detecção de erro ortográfico.
 */
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
};

/**
 * Procura uma tag canônica equivalente entre as existentes.
 * - Match exato normalizado → reutiliza.
 * - Distância <= 2 em palavras com 5+ chars → reutiliza (corrige erro ortográfico).
 * - Senão → retorna a própria tag (com trim).
 */
export const findCanonicalTag = (input: string, existing: string[]): string => {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const norm = normalizeTag(trimmed);

  // 1) match exato normalizado
  const exact = existing.find((t) => normalizeTag(t) === norm);
  if (exact) return exact;

  // 2) match aproximado para erros ortográficos
  if (norm.length >= 5) {
    let best: { tag: string; dist: number } | null = null;
    for (const t of existing) {
      const tn = normalizeTag(t);
      if (Math.abs(tn.length - norm.length) > 2) continue;
      const d = levenshtein(norm, tn);
      if (d <= 2 && (!best || d < best.dist)) {
        best = { tag: t, dist: d };
      }
    }
    if (best) return best.tag;
  }

  return trimmed;
};
