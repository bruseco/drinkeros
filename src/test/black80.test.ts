import {describe,it,expect} from 'vitest';
import {black80Active,black80Price} from '../../supabase/functions/_shared/black80';
const enabled={enabled:true};
const now=Date.parse('2026-11-27T12:00:00-03:00');
describe('BLACK80 server and display pricing',()=>{
 it('requires explicit activation and ends exactly after Dec 5 in Brasilia',()=>{
  expect(black80Active({enabled:false},now)).toBe(false);
  expect(black80Active(enabled,Date.parse('2026-11-25T23:59:59-03:00'))).toBe(false);
  expect(black80Active(enabled,Date.parse('2026-12-05T23:59:59-03:00'))).toBe(true);
  expect(black80Active(enabled,Date.parse('2026-12-06T00:00:00-03:00'))).toBe(false);
 });
 it('takes 80% from the catalog base in cents without stacking VIP or quiz discounts',()=>{
  expect(black80Price('course','mixologia-avancada',797,297,enabled,now)).toBe(159.4);
  expect(black80Price('course','classicos-destilados',697,197,enabled,now)).toBe(197);
  expect(black80Price('course','classicos-destilados',697,697,enabled,now)).toBe(697);
  expect(black80Price('ebook','ebook',27,27,enabled,now)).toBe(5.4);
  expect(black80Price('combo','pacote-6-e-books',147,47,enabled,now)).toBe(29.4);
  expect(black80Price('course','special',100,10,enabled,now)).toBe(10);
 });
 it('preserves RAND, monthly and prices after expiry or when disabled',()=>{
  expect(black80Price('combo','rand',197,197,enabled,now)).toBe(197);
  expect(black80Price('club','clube-mensal-b',7,7,enabled,now)).toBe(7);
  expect(black80Price('club','clube',9.9,9.9,enabled,now)).toBe(9.9);
  expect(black80Price('club','clube-anual',97,87,enabled,now)).toBe(47);
  expect(black80Price('course','course',497,497,{enabled:false},now)).toBe(497);
  expect(black80Price('course','course',497,497,enabled,Date.parse('2026-12-06T03:00:00Z'))).toBe(497);
 });
});
