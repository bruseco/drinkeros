export const BLACK80_START = '2026-11-26T00:00:00-03:00';
export const BLACK80_END = '2026-12-06T00:00:00-03:00';
export type Black80Campaign = { enabled: boolean; server_now?: string };
export function black80Active(campaign: Black80Campaign | null | undefined, now = Date.now()) {
  return campaign?.enabled === true && now >= Date.parse(BLACK80_START) && now < Date.parse(BLACK80_END);
}
/** No stacking. RAND and monthly subscriptions keep their existing conditions. */
export function black80Price(type: string, slug: string, base: number, current: number, campaign: Black80Campaign | null | undefined, now = Date.now()) {
  if (!black80Active(campaign, now) || slug === 'rand') return current;
  if (type === 'club') return slug === 'clube-anual' ? Math.min(current, 47) : current;
  if (!['course','ebook','combo','package'].includes(type) || !Number.isFinite(base) || base <= 0) return current;
  return Math.min(current, Math.round(base * 20) / 100);
}
export async function loadBlack80(admin: any): Promise<Black80Campaign> {
  const {data,error} = await admin.rpc('public_black80_campaign');
  if (error || !data?.[0]) throw Error('Não foi possível confirmar a promoção. Atualize a página antes de pagar.');
  return data[0];
}
