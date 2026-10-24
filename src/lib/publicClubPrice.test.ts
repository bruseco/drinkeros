import { expect,it,vi } from 'vitest';
import { publicClubPrice,PublicClubPriceChanged } from '../../supabase/functions/_shared/publicClubPrice';
it('rejects a stale displayed price instead of silently charging the higher expired price',async()=>{
  const admin={rpc:vi.fn().mockResolvedValue({data:[{price:197}],error:null})};
  await expect(publicClubPrice(admin,'account',97)).rejects.toBeInstanceOf(PublicClubPriceChanged);
  expect(await publicClubPrice(admin,'account',197)).toBe(197);
});
it('cannot bypass an expired account offer by omitting the public landing flag',async()=>{
  const admin={rpc:vi.fn().mockResolvedValue({data:[{price:197}],error:null})};
  await expect(publicClubPrice(admin,'account',97,false)).rejects.toThrow();
});
it('keeps legacy accounts without a public offer and fails closed on server errors',async()=>{
  const admin={rpc:vi.fn().mockResolvedValue({data:[],error:null})};
  expect(await publicClubPrice(admin,'account',97)).toBeNull();
  await expect(publicClubPrice(admin,'account',97,true)).rejects.toThrow();
  admin.rpc.mockResolvedValue({data:null,error:{message:'offline'}});
  await expect(publicClubPrice(admin,'account',97)).rejects.toThrow();
});
