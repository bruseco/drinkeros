import {act,cleanup,render} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ClubFavoriteDemo from './ClubFavoriteDemo';
import ClubShoppingDemo from './ClubShoppingDemo';
const mocks=vi.hoisted(()=>({visible:true}));
vi.mock('./useViewportMotion',()=>({useViewportMotion:()=>mocks.visible}));
beforeEach(()=>{mocks.visible=true;vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','performance']});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}})});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()});
it.each([[ClubFavoriteDemo,'card'],[ClubShoppingDemo,'choose']] as const)('waits one second and restarts the demo when visibility returns', (Component,initial)=>{
 const {container,rerender}=render(<Component/>);const figure=()=>container.querySelector('figure')!;
 expect(figure().getAttribute('data-motion-active')).toBe('false');expect(figure().getAttribute('data-phase')).toBe(initial);
 act(()=>vi.advanceTimersByTime(999));expect(figure().getAttribute('data-motion-active')).toBe('false');
 act(()=>vi.advanceTimersByTime(1));expect(figure().getAttribute('data-motion-active')).toBe('true');
 act(()=>vi.advanceTimersByTime(4000));expect(figure().getAttribute('data-phase')).not.toBe(initial);
 mocks.visible=false;rerender(<Component/>);expect(figure().getAttribute('data-motion-active')).toBe('false');expect(figure().getAttribute('data-phase')).toBe(initial);
 act(()=>vi.advanceTimersByTime(10000));expect(figure().getAttribute('data-phase')).toBe(initial);
 mocks.visible=true;rerender(<Component/>);act(()=>vi.advanceTimersByTime(999));expect(figure().getAttribute('data-motion-active')).toBe('false');act(()=>vi.advanceTimersByTime(1));expect(figure().getAttribute('data-motion-active')).toBe('true');expect(figure().getAttribute('data-phase')).toBe(initial);
});
