// Validação de e-mail em tempo real + sugestão de correção para erros comuns de digitação.

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const COMMON_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "me.com",
  "protonmail.com",
];

export const isValidEmailFormat = (email: string) => EMAIL_RE.test(email.trim());

// Distância de Levenshtein simples (suficiente para domínios curtos).
const distance = (a: string, b: string) => {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
};

/** Retorna o e-mail sugerido (ex.: "gmial.com" → "gmail.com") ou null. */
export const suggestEmail = (email: string): string | null => {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  let best: { domain: string; dist: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const d = distance(domain, candidate);
    if (!best || d < best.dist) best = { domain: candidate, dist: d };
  }
  if (best && best.dist > 0 && best.dist <= 2) return `${local}@${best.domain}`;
  return null;
};
