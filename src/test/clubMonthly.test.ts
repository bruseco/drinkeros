import {expect,it} from 'vitest';
import {paidMonthlyPeriod} from '../../supabase/functions/_shared/clubMonthly';
it('uses one paid calendar month and never extends access when the same payment is replayed',()=>{
 const payment={status:'approved',date_approved:'2026-01-31T12:00:00Z',transaction_amount:7,currency_id:'BRL'};
 expect(paidMonthlyPeriod(payment).end.toISOString()).toBe('2026-02-28T12:00:00.000Z');
 expect(paidMonthlyPeriod(payment).end).toEqual(paidMonthlyPeriod(payment).end);
 expect(()=>paidMonthlyPeriod({...payment,status:'authorized'})).toThrow();
 expect(()=>paidMonthlyPeriod({...payment,transaction_amount:1})).toThrow();
 expect(()=>paidMonthlyPeriod({...payment,date_approved:'invalid'})).toThrow();
});
