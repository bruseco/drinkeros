import React from 'react';
import {renderHook,waitFor,cleanup} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,expect,it,vi} from 'vitest';
import {useAbTest,useAbVariantTrack} from './useAbTest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mocks.rpc}}));
afterEach(()=>{cleanup();vi.clearAllMocks();sessionStorage.clear();document.cookie='ab:clube-receitas=; path=/; max-age=0';});
it('keeps public traffic out of the legacy variant and loads only its own test',async()=>{
 mocks.rpc.mockResolvedValue({data:null});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const wrapper=({children}:{children:React.ReactNode})=><MemoryRouter initialEntries={['/clube-receitas']}><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
 renderHook(()=>{useAbVariantTrack('clube','b',false);useAbTest('clube-receitas',true);},{wrapper});
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('get_ab_test_config',{_page_key:'clube-receitas'}));
 expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('does not load the public test on an internal page',()=>{
 mocks.rpc.mockResolvedValue({data:null});
 const client=new QueryClient();
 const wrapper=({children}:{children:React.ReactNode})=><MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
 renderHook(()=>useAbTest('clube-receitas',false),{wrapper});
 expect(mocks.rpc).not.toHaveBeenCalled();
});

it('redirects an assigned B visitor without recording an extra visit on A',async()=>{
 mocks.rpc.mockResolvedValue({data:[{page_key:'clube-receitas',status:'active',traffic_split_pct:100,original_path:'/clube-receitas',variant_path:'/clube-receitas-b'}],error:null});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const wrapper=({children}:{children:React.ReactNode})=><MemoryRouter initialEntries={['/clube-receitas']}><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
 const {result}=renderHook(()=>{const ready=useAbTest('clube-receitas');return {ready,path:useLocation().pathname};},{wrapper});
 await waitFor(()=>expect(result.current.path).toBe('/clube-receitas-b'));
 expect(mocks.rpc.mock.calls.some(call=>call[0]==='ab_increment_visit')).toBe(false);
});
