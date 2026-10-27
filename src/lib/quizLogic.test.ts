import {describe,it,expect} from 'vitest';
import {computeProfile,getQuestionOrder,buildDestinationUrl,PROFILES,cleanQuizAnswers,allowedQuizProducts} from './quizLogic';
describe('quiz offer branches',()=>{
 it.each([
  [{q1:'A',q2_casa:'A'},'pack'],[{q1:'A',q2_casa:'B'},'clube'],[{q1:'A',q2_casa:'C'},'xperience'],
  [{q1:'B',q2_profissional:'A'},'xperience'],[{q1:'B',q2_profissional:'B'},'mixologia'],[{q1:'B',q2_profissional:'C'},'mixologia'],[{q1:'B',q2_profissional:'D'},'bordo'],
  [{q1:'C',q2_empreender:'A'},'eventos'],[{q1:'C',q2_empreender:'B'},'delivery'],[{q1:'C',q2_empreender:'C',q3:'A'},'delivery'],[{q1:'C',q2_empreender:'C',q3:'B'},'eventos'],
 ] as const)('maps %j to %s',(answers,profile)=>expect(computeProfile(answers)).toBe(profile));
 it('asks P3 only for undecided entrepreneurs and rejects incomplete/foreign answers',()=>{
  expect(getQuestionOrder({q1:'C',q2_empreender:'C'})).toEqual(['q1','q2_empreender','q3']);
  expect(getQuestionOrder({q1:'A'})).toEqual(['q1','q2_casa']);
  expect(()=>computeProfile({q1:'A',q2_profissional:'A'})).toThrow();
  expect(()=>computeProfile({q1:'D'})).toThrow();
  expect(cleanQuizAnswers({q1:'A',q2_casa:'B',q3:'A'})).toEqual({q1:'A',q2_casa:'B'});
 });
 it('preserves original attribution, separating profile and excluding private parameters',()=>{
  const url=new URL(buildDestinationUrl(PROFILES.mixologia,'?utm_content=criativo1&utm_source=meta&fbclid=abc&email=private'),'https://drinkeros.com');
  expect(url.searchParams.get('utm_content')).toBe('criativo1');expect(url.searchParams.get('quiz_profile')).toBe('mixologia');expect(url.searchParams.get('fbclid')).toBe('abc');expect(url.searchParams.has('email')).toBe(false);
 });
 it('does not unlock unrelated products through plan B',()=>{expect(allowedQuizProducts('xperience','casa')).toEqual(['xperience','clube']);expect(allowedQuizProducts('pack','casa')).toEqual(['pack']);expect(allowedQuizProducts('mixologia','profissional')).toEqual(['mixologia','clube']);});
});
