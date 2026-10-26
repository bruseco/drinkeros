import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quizJourneyAt, rememberQuizJourney } from './quizJourney';

describe('quiz journey attribution', () => {
  beforeEach(() => { sessionStorage.clear(); vi.useRealTimers(); });
  it('requires an actual quiz departure, landing arrival, and matching checkout', () => {
    expect(quizJourneyAt('/mixologia-avancada')).toBeNull();
    rememberQuizJourney('profissional');
    expect(quizJourneyAt('/checkout/course/mixologia-avancada')).toBeNull();
    rememberQuizJourney('profissional');
    expect(quizJourneyAt('/mixologia-avancada')?.event).toBe('quiz_landing_viewed');
    expect(quizJourneyAt('/login')).toBeNull();
    expect(quizJourneyAt('/checkout/course/mixologia-avancada')).toEqual({ event: 'quiz_checkout_viewed', metadata: { profile: 'profissional', destination: '/mixologia-avancada' } });
  });
  it('does not credit a different product or subsequent unrelated landing', () => {
    rememberQuizJourney('criador');
    quizJourneyAt('/drinkeros-xperience');
    expect(quizJourneyAt('/checkout/course/bar-p-eventos')).toBeNull();
    expect(quizJourneyAt('/checkout/course/drinkeros-xperience')).toBeNull();
    rememberQuizJourney('criador');
    quizJourneyAt('/bar-p-eventos');
    expect(quizJourneyAt('/drinkeros-xperience')).toBeNull();
  });
  it('expires after two hours and resets on a new quiz visit', () => {
    vi.useFakeTimers();
    rememberQuizJourney('aventureiro');
    vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1);
    expect(quizJourneyAt('/bartender-a-bordo')).toBeNull();
    rememberQuizJourney('criador');
    quizJourneyAt('/quiz');
    expect(quizJourneyAt('/drinkeros-xperience')).toBeNull();
    vi.useRealTimers();
  });
  it('ignores malformed storage and foreign profile names', () => {
    sessionStorage.setItem('quiz:journey:v1', '{bad');
    expect(quizJourneyAt('/mixologia-avancada')).toBeNull();
    sessionStorage.setItem('quiz:journey:v1', JSON.stringify({ profile: '__proto__', startedAt: Date.now() }));
    expect(quizJourneyAt('/mixologia-avancada')).toBeNull();
  });
});
