import { describe, it, expect } from 'vitest';
import { computeProfile, getQuestionOrder, buildDestinationUrl, PROFILES } from './quizLogic';

describe('quizLogic', () => {
  it('P4 só aparece com intenção de empreender', () => {
    expect(getQuestionOrder({ q1: 'A', q3: 'B' })).toHaveLength(3);
    expect(getQuestionOrder({ q1: 'D' })).toHaveLength(4);
    expect(getQuestionOrder({ q1: 'A', q3: 'D' })).toHaveLength(4);
  });

  it('P4 define os perfis de negócio', () => {
    expect(computeProfile({ q1: 'D', q2: 'A', q3: 'D', q4: 'A' })).toBe('empreendedor_delivery');
    expect(computeProfile({ q1: 'D', q2: 'A', q3: 'D', q4: 'B' })).toBe('empreendedor_eventos');
    expect(computeProfile({ q1: 'A', q2: 'A', q3: 'D', q4: 'C' })).toBe('aventureiro');
  });

  it('intenção pesa mais que o nível', () => {
    expect(computeProfile({ q1: 'A', q2: 'D', q3: 'C' })).toBe('criador'); // 3 vs 3 → P1
    expect(computeProfile({ q1: 'B', q2: 'B', q3: 'A' })).toBe('aspirante');
    expect(computeProfile({ q1: 'C', q2: 'D', q3: 'A' })).toBe('profissional');
    expect(computeProfile({ q1: 'C', q2: 'B', q3: 'B' })).toBe('criador');
  });

  it('mantém UTMs e marca utm_content', () => {
    const url = buildDestinationUrl(PROFILES.profissional, '?utm_source=fb&fbclid=x&email=a@b.c');
    expect(url).toBe('/mixologia-avancada?utm_source=fb&fbclid=x&utm_content=quiz-profissional');
  });
});
