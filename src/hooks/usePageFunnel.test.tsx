import {renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {usePageFunnel} from './usePageFunnel';
import {getFunnel} from '@/lib/funnels';
import {customFunnelBounds} from '@/lib/funnelPeriod';
const mocks=vi.hoisted(()=>({query:vi.fn(),rpc:vi.fn()}));
vi.mock('@tanstack/react-query',()=>({useQuery:(options:unknown)=>mocks.query(options)}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc}}));
afterEach(()=>vi.clearAllMocks());
it('changes query keys and cutoff when the preset changes',async()=>{
 mocks.rpc.mockResolvedValue({data:[],error:null});const f=getFunnel('clube-receitas');
 const {rerender}=renderHook(({range})=>usePageFunnel(f,range),{initialProps:{range:'7d' as '7d'|'all'}});
 const first=mocks.query.mock.calls.at(-1)![0];await first.queryFn();expect(mocks.rpc.mock.calls.at(-1)![1]._since).toBeTruthy();
 rerender({range:'all'});const second=mocks.query.mock.calls.at(-1)![0];expect(second.queryKey).not.toEqual(first.queryKey);await second.queryFn();expect(mocks.rpc.mock.calls.at(-1)![1]._since).toBeNull();
});
it('sends both custom bounds to event and sales aggregates',async()=>{
 mocks.rpc.mockResolvedValue({data:[],error:null});const dates={from:'2026-10-01',to:'2026-10-25'},bounds=customFunnelBounds(dates)!;
 renderHook(()=>usePageFunnel(getFunnel('rand'),'custom',dates));await mocks.query.mock.calls.at(-1)![0].queryFn();
 expect(mocks.rpc).toHaveBeenCalledWith('get_page_funnel_window',{_page_key:'rand',_since:bounds.since,_until:bounds.until});
 expect(mocks.rpc).toHaveBeenCalledWith('get_page_funnel_sales_window',expect.objectContaining({_since:bounds.since,_until:bounds.until}));
});
it('reports failed sales queries instead of presenting a false zero',async()=>{
 const error=new Error('sales unavailable');mocks.rpc.mockImplementation((name:string)=>Promise.resolve(name==='get_page_funnel'?{data:[],error:null}:{data:null,error}));
 renderHook(()=>usePageFunnel(getFunnel('rand'),'all'));
 await expect(mocks.query.mock.calls.at(-1)![0].queryFn()).rejects.toThrow('sales unavailable');
});
it('reads confirmed Club payments separately from purchase clicks',async()=>{
 mocks.rpc.mockImplementation((name:string)=>Promise.resolve({data:name==='get_club_ab_purchases'?[{variant:'a',purchases:3},{variant:'b',purchases:2}]:[{event:'checkout_1_started',count:12}],error:null}));
 renderHook(()=>usePageFunnel(getFunnel('clube-receitas'),'all'));
 const result=await mocks.query.mock.calls.at(-1)![0].queryFn();
 expect(result.checkout).toBe(12);expect(result.purchase).toBe(3);
 expect(mocks.rpc).toHaveBeenCalledWith('get_club_ab_purchases',{_since:null,_until:null});
});

it('keeps purchases from variant B separate from A',async()=>{
 mocks.rpc.mockImplementation((name:string)=>Promise.resolve({data:name==='get_club_ab_purchases'?[{variant:'a',purchases:3},{variant:'b',purchases:2}]:[],error:null}));
 renderHook(()=>usePageFunnel(getFunnel('clube-receitas-b'),'all'));
 expect((await mocks.query.mock.calls.at(-1)![0].queryFn()).purchase).toBe(2);
});
