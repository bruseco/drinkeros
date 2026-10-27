import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quizJourneyAt, rememberQuizJourney } from './quizJourney';

describe('quiz journey attribution', () => {
  beforeEach(() => { sessionStorage.clear(); vi.useRealTimers(); });
  it('requires an actual quiz departure, landing arrival, and matching checkout', () => {
    expect(quizJourneyAt('/quiz-mixologia-avancada')).toBeNull();
    rememberQuizJourney('mixologia');
    expect(quizJourneyAt('/checkout/course/mixologia-avancada')).toBeNull();
    rememberQuizJourney('mixologia');
    expect(quizJourneyAt('/quiz-mixologia-avancada')?.event).toBe('quiz_landing_viewed');
    expect(quizJourneyAt('/login')).toBeNull();
    expect(quizJourneyAt('/checkout/course/mixologia-avancada')).toEqual({ event: 'quiz_checkout_viewed', metadata: { profile: 'mixologia', destination: '/quiz-mixologia-avancada' } });
  });
  it('does not credit a different product or subsequent unrelated landing', () => {
    rememberQuizJourney('xperience');
    quizJourneyAt('/quiz-xperience');
    expect(quizJourneyAt('/checkout/course/bar-p-eventos')).toBeNull();
    expect(quizJourneyAt('/checkout/course/drinkeros-xperience')).toBeNull();
    rememberQuizJourney('xperience');
    quizJourneyAt('/bar-p-eventos');
    expect(quizJourneyAt('/quiz-xperience')).toBeNull();
  });
  it('expires after two hours and resets on a new quiz visit', () => {
    vi.useFakeTimers();
    rememberQuizJourney('bordo');
    vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1);
    expect(quizJourneyAt('/quiz-bartender-a-bordo')).toBeNull();
    rememberQuizJourney('xperience');
    quizJourneyAt('/quiz');
    expect(quizJourneyAt('/quiz-xperience')).toBeNull();
    vi.useRealTimers();
  });
  it('ignores malformed storage and foreign profile names', () => {
    sessionStorage.setItem('quiz:journey:v1', '{bad');
    expect(quizJourneyAt('/quiz-mixologia-avancada')).toBeNull();
    sessionStorage.setItem('quiz:journey:v1', JSON.stringify({ profile: '__proto__', startedAt: Date.now() }));
    expect(quizJourneyAt('/quiz-mixologia-avancada')).toBeNull();
  });
});
