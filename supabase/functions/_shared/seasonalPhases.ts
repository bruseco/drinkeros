// Calendário sazonal anual de fases para destaque de drinks.
// As fases se repetem todos os anos automaticamente.
// Datas em horário local (America/Sao_Paulo é o público alvo, mas usamos local
// time do dispositivo, suficiente para granularidade de dias).

export type SeasonalPhaseId =
  | 'natal'
  | 'halloween'
  | 'carnaval'
  | 'festa_junina'
  | 'inverno'
  | 'verao';

export interface SeasonalPhase {
  id: SeasonalPhaseId;
  label: string;
  /** Prioridade — menor = maior prioridade quando múltiplas fases ativas. */
  priority: number;
  /** Tags de "characteristics" que marcam um drink como pertencente à fase. */
  tags: string[];
  /** Tags adicionais incluídas, com regra de exclusão. */
  includeTags?: { tag: string; excludeIfHasAny?: string[] }[];
}

const PHASES: Record<SeasonalPhaseId, Omit<SeasonalPhase, 'id'>> = {
  natal: { label: 'Natal', priority: 1, tags: ['Natal'] },
  halloween: { label: 'Halloween', priority: 2, tags: ['Halloween'] },
  carnaval: {
    label: 'Carnaval',
    priority: 3,
    tags: ['Carnaval'],
    includeTags: [
      { tag: 'Drinks de Galera', excludeIfHasAny: ['Festa Junina', 'Halloween', 'Natal'] },
    ],
  },
  festa_junina: { label: 'Festa Junina', priority: 4, tags: ['Festa Junina'] },
  inverno: { label: 'Inverno', priority: 5, tags: ['Inverno'] },
  verao: { label: 'Verão', priority: 6, tags: ['Verão'] },
};

// ---------- Cálculo da Páscoa (algoritmo de Meeus/Jones/Butcher) ----------
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Março, 4=Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Terça-feira de Carnaval = 47 dias antes do Domingo de Páscoa. */
function carnivalTuesday(year: number): Date {
  const easter = easterSunday(year);
  const t = new Date(easter);
  t.setDate(t.getDate() - 47);
  return t;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Range [start, end] inclusivo no nível do dia. */
interface DateRange {
  start: Date;
  end: Date;
}

function md(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/** Constrói os ranges de cada fase para um ano. Pode incluir wrap (Natal). */
function rangesForYear(year: number): Record<SeasonalPhaseId, DateRange[]> {
  const tCarnaval = carnivalTuesday(year);
  return {
    carnaval: [{ start: addDays(tCarnaval, -30), end: addDays(tCarnaval, 14) }],
    verao: [{ start: md(year, 1, 4), end: md(year, 4, 3) }],
    festa_junina: [{ start: md(year, 5, 15), end: md(year, 6, 28) }],
    inverno: [{ start: md(year, 6, 1), end: md(year, 8, 29) }],
    halloween: [{ start: md(year, 9, 17), end: md(year, 10, 31) }],
    // Natal cruza o ano: usamos dois segmentos para garantir match em jan
    natal: [
      { start: md(year, 11, 20), end: md(year, 12, 31) },
      { start: md(year, 1, 1), end: md(year, 1, 3) },
    ],
  };
}

function isInRange(date: Date, r: DateRange): boolean {
  const t = date.getTime();
  // Normaliza para fim do dia em "end"
  const endEod = new Date(r.end);
  endEod.setHours(23, 59, 59, 999);
  return t >= r.start.getTime() && t <= endEod.getTime();
}

/** Retorna todas as fases ativas em uma data, ordenadas por prioridade. */
export function getActivePhases(date: Date = new Date()): SeasonalPhase[] {
  const year = date.getFullYear();
  const ranges = rangesForYear(year);
  // Para Natal, também precisamos checar contra ranges do ano anterior (segmento de dezembro)
  const prevRanges = rangesForYear(year - 1);

  const active: SeasonalPhase[] = [];
  (Object.keys(PHASES) as SeasonalPhaseId[]).forEach((id) => {
    const all = [...ranges[id], ...(id === 'natal' ? prevRanges[id] : [])];
    if (all.some((r) => isInRange(date, r))) {
      active.push({ id, ...PHASES[id] });
    }
  });
  active.sort((a, b) => a.priority - b.priority);
  return active;
}

/** Fase com maior prioridade ativa, ou null. */
export function getPrimaryPhase(date: Date = new Date()): SeasonalPhase | null {
  return getActivePhases(date)[0] ?? null;
}

/** Tags estritamente sazonais — só devem aparecer durante suas respectivas fases. */
const STRICT_SEASONAL_TAGS = ['Natal', 'Halloween', 'Carnaval', 'Festa Junina', 'Verão', 'Inverno'];

/**
 * Retorna true se o drink deve ser ocultado por estar fora da sua época sazonal.
 * Um drink é ocultado se possui alguma tag sazonal estrita E nenhuma das suas
 * fases está atualmente ativa.
 */
export function isOutOfSeason(characteristics: string[] | null | undefined, date: Date = new Date()): boolean {
  const chars = characteristics ?? [];
  if (chars.length === 0) return false;

  const seasonalTagsOnDrink = chars.filter((c) => STRICT_SEASONAL_TAGS.includes(c));
  if (seasonalTagsOnDrink.length === 0) return false;

  const activeTags = new Set(getActivePhases(date).flatMap((p) => p.tags));
  // Se ao menos uma das tags sazonais do drink está ativa agora, mostra.
  return !seasonalTagsOnDrink.some((t) => activeTags.has(t));
}

/**
 * Verifica se um drink (suas characteristics) deve ser destacado para a fase.
 * Aplica regra de exclusão das includeTags (ex: Drinks de Galera no Carnaval
 * só entra se NÃO tiver Festa Junina/Halloween/Natal).
 */
export function matchesPhase(characteristics: string[] | null | undefined, phase: SeasonalPhase): boolean {
  const chars = characteristics ?? [];
  if (chars.length === 0) return false;

  // Tag direta da fase
  if (phase.tags.some((t) => chars.includes(t))) return true;

  // Tags inclusas com regra de exclusão
  if (phase.includeTags) {
    for (const inc of phase.includeTags) {
      if (chars.includes(inc.tag)) {
        const excludes = inc.excludeIfHasAny ?? [];
        if (!excludes.some((ex) => chars.includes(ex))) return true;
      }
    }
  }

  return false;
}

// ---------- Início de fase (usado pelo push sazonal server-side) ----------

/** Títulos de push por fase. */
export const PHASE_PUSH_TITLES: Record<SeasonalPhaseId, string> = {
  verao: 'O Verão chegou! ☀️',
  inverno: 'O Inverno chegou! ❄️',
  carnaval: 'O Carnaval está chegando! 🎉',
  festa_junina: 'A Festa Junina está chegando! 🌽',
  halloween: 'Halloween está chegando! 🎃',
  natal: 'O Natal está chegando! 🎄',
};

/**
 * Retorna a fase principal que COMEÇA (vira principal) na data informada,
 * comparando com o dia anterior. Null se a fase principal não mudou.
 * `date` deve representar o dia local de America/Sao_Paulo (componentes locais).
 */
export function getPrimaryPhaseStartingOn(date: Date): SeasonalPhase | null {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const cur = getPrimaryPhase(today);
  const prev = getPrimaryPhase(yesterday);
  if (!cur || cur.id === prev?.id) return null;
  return cur;
}
