import { PROFILES, type ProfileId } from './quizLogic';

const KEY = 'quiz:journey:v1';
const MAX_AGE = 2 * 60 * 60 * 1000;
type Journey = { profile: ProfileId; startedAt: number; landed: boolean };

export function rememberQuizJourney(profile: ProfileId) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ profile, startedAt: Date.now(), landed: false })); } catch { /* storage unavailable */ }
}

/** Only the selected destination and its own checkout belong to this journey. */
export function quizJourneyAt(path: string): { event: 'quiz_landing_viewed' | 'quiz_checkout_viewed'; metadata: { profile: ProfileId; destination: string } } | null {
  try {
    if (path === '/quiz') { sessionStorage.removeItem(KEY); return null; }
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Journey;
    if (!Object.prototype.hasOwnProperty.call(PROFILES, j.profile) || !Number.isFinite(j.startedAt) || Date.now() < j.startedAt || Date.now() - j.startedAt > MAX_AGE) {
      sessionStorage.removeItem(KEY); return null;
    }
    const destination = PROFILES[j.profile].path;
    const metadata = { profile: j.profile, destination };
    if (path === destination) {
      j.landed = true;
      sessionStorage.setItem(KEY, JSON.stringify(j));
      return { event: 'quiz_landing_viewed', metadata };
    }
    if (j.landed && path === `/checkout/course${destination}`) return { event: 'quiz_checkout_viewed', metadata };
    if (Object.values(PROFILES).some(p => p.path === path) || path.startsWith('/checkout/')) sessionStorage.removeItem(KEY);
  } catch { /* malformed or blocked storage must not interrupt navigation */ }
  return null;
}
