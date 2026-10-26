import {afterEach,expect,it,vi} from 'vitest';
import {clubCheckoutVariant,rememberClubCheckoutVariant} from './clubAbCheckout';
import {recordClubAbAttribution} from '../../supabase/functions/_shared/clubAbAttribution';
afterEach(()=>{sessionStorage.clear();vi.useRealTimers();});
it('keeps the checkout variant and expires old attribution',()=>{
 vi.useFakeTimers();rememberClubCheckoutVariant('b');expect(clubCheckoutVariant()).toBe('b');vi.advanceTimersByTime(2*60*60*1000);expect(clubCheckoutVariant()).toBeUndefined();rememberClubCheckoutVariant('a');rememberClubCheckoutVariant(null);expect(clubCheckoutVariant()).toBeUndefined();
});
it('records attribution once per gateway reference and never interrupts a payment for analytics errors',async()=>{
 const upsert=vi.fn().mockResolvedValue({error:null}),admin={from:vi.fn().mockReturnValue({upsert})};
 await recordClubAbAttribution(admin,'b',{payment_id:'test-payment'});
 expect(upsert).toHaveBeenCalledWith({variant:'b',payment_id:'test-payment'},{onConflict:'payment_id',ignoreDuplicates:true});
 await recordClubAbAttribution(admin,'invalid',{payment_id:'other'});expect(upsert).toHaveBeenCalledTimes(1);
 upsert.mockRejectedValue(new Error('offline'));await expect(recordClubAbAttribution(admin,'a',{payment_id:'test-payment'})).resolves.toBeUndefined();
});
