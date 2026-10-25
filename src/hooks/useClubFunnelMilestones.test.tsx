import {createRef} from 'react';
import {renderHook,act,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useClubFunnelMilestones} from './useClubFunnelMilestones';
import {trackFunnel} from '@/lib/funnelTracking';
vi.mock('@/lib/funnelTracking',()=>({trackFunnel:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.restoreAllMocks()});
function root(){const current=document.createElement('div');Object.defineProperties(current,{scrollHeight:{value:3000},clientHeight:{value:1000}});const ref=createRef<HTMLDivElement>();Object.assign(ref,{current});return ref}
it('counts halfway using the actual scrolling distance, only once',()=>{
 const ref=root();renderHook(()=>useClubFunnelMilestones(ref,true,false));
 act(()=>{ref.current!.scrollTop=999;ref.current!.dispatchEvent(new Event('scroll'))});expect(trackFunnel).not.toHaveBeenCalled();
 act(()=>{ref.current!.scrollTop=1000;ref.current!.dispatchEvent(new Event('scroll'));ref.current!.dispatchEvent(new Event('scroll'))});
 expect(trackFunnel).toHaveBeenCalledTimes(1);expect(trackFunnel).toHaveBeenCalledWith('clube-receitas','scroll_50',{userId:null});
});
it('counts the visible offer separately without claiming the discount',()=>{
 const ref=root();const {rerender}=renderHook(({open})=>useClubFunnelMilestones(ref,true,open),{initialProps:{open:false}});
 expect(trackFunnel).not.toHaveBeenCalled();rerender({open:true});rerender({open:false});rerender({open:true});
 expect(trackFunnel).toHaveBeenCalledTimes(1);expect(trackFunnel).toHaveBeenCalledWith('clube-receitas','offer_viewed',{userId:null});
});
it('waits for the tab to become visible and leaves the internal landing unchanged',()=>{
 const visibility=vi.spyOn(document,'hidden','get').mockReturnValue(true);const ref=root();ref.current!.scrollTop=1200;
 const {rerender}=renderHook(({enabled})=>useClubFunnelMilestones(ref,enabled,true),{initialProps:{enabled:false}});
 expect(trackFunnel).not.toHaveBeenCalled();rerender({enabled:true});expect(trackFunnel).not.toHaveBeenCalled();
 visibility.mockReturnValue(false);act(()=>document.dispatchEvent(new Event('visibilitychange')));
 expect(trackFunnel).toHaveBeenCalledTimes(2);
});
