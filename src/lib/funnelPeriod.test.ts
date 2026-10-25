import {expect,it} from 'vitest';
import {customFunnelBounds,funnelPeriodBounds,funnelPeriodQuery} from './funnelPeriod';
it('uses local midnight and includes the whole last day',()=>{
 const result=customFunnelBounds({from:'2026-10-25',to:'2026-10-25'})!;
 expect(new Date(result.since)).toEqual(new Date(2026,9,25));
 expect(new Date(result.until)).toEqual(new Date(2026,9,26));
});
it('rejects missing, invalid or reversed dates',()=>{
 for(const dates of [{from:'',to:''},{from:'2026-02-30',to:'2026-03-01'},{from:'2026-10-26',to:'2026-10-25'}])expect(customFunnelBounds(dates)).toBeNull();
});
it('preserves the custom dates in detail navigation and all-time has no cutoff',()=>{
 expect(funnelPeriodQuery('custom',{from:'2026-10-01',to:'2026-10-25'})).toBe('periodo=custom&de=2026-10-01&ate=2026-10-25');
 expect(funnelPeriodBounds('all')).toEqual({since:null,until:null});
});
