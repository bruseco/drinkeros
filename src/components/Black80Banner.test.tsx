import {afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Black80Banner from './Black80Banner';
const m=vi.hoisted(()=>({active:true}));
vi.mock('@/hooks/useBlack80',()=>({useBlack80:()=>({active:m.active})}));
afterEach(()=>{cleanup();m.active=true});
it('shows a prominent campaign, clear exceptions and the catalog link for logged-in users',()=>{
 render(<MemoryRouter initialEntries={['/app']}><Black80Banner member/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/VER OFERTAS/})).toHaveAttribute('href','/black80');
 expect(screen.getByText(/RAND e Clube mensal não participam/)).toBeInTheDocument();
 expect(screen.getByText('R$47')).toBeInTheDocument();
 expect(screen.getByRole('complementary')).toHaveStyle({background:'linear-gradient(110deg, #9d174d 0%, #db2777 45%, #ec4899 100%)'});
});
it.each(['/login','/quiz','/rand','/checkout/course/drinkeros-xperience','/app/login'])('covers public customer pages: %s',path=>{
 render(<MemoryRouter initialEntries={[path]}><Black80Banner member={path.startsWith('/app/')}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/VER OFERTAS/})).toBeInTheDocument();
});
it('stays hidden when disabled and avoids duplicating the member banner',()=>{
 const r=render(<MemoryRouter initialEntries={['/app/receitas']}><Black80Banner/></MemoryRouter>);
 expect(screen.queryByRole('link')).toBeNull();r.unmount();m.active=false;
 render(<MemoryRouter initialEntries={['/mixologia-avancada']}><Black80Banner/></MemoryRouter>);
 expect(screen.queryByRole('link')).toBeNull();
});

it('pins a compact offer only after scrolling past the full banner and disconnects on unmount',()=>{
 let notify: IntersectionObserverCallback;
 const disconnect=vi.fn();
 vi.stubGlobal('IntersectionObserver',vi.fn(function(callback:IntersectionObserverCallback){notify=callback;return {observe:vi.fn(),disconnect}}));
 const view=render(<MemoryRouter><Black80Banner/></MemoryRouter>);
 const update=(isIntersecting:boolean,bottom:number)=>act(()=>notify([{isIntersecting,boundingClientRect:{bottom}} as IntersectionObserverEntry],{} as IntersectionObserver));
 expect(screen.queryByRole('complementary',{name:'Resumo da oferta Black Friday'})).toBeNull();
 update(false,300);
 expect(screen.queryByRole('complementary',{name:'Resumo da oferta Black Friday'})).toBeNull();
 update(false,-1);
 expect(screen.getByRole('complementary',{name:'Resumo da oferta Black Friday'})).toHaveClass('fixed','top-0');
 expect(screen.getByText(/Até 05\/12, às 23h59/)).toBeInTheDocument();
 update(true,180);
 expect(screen.queryByRole('complementary',{name:'Resumo da oferta Black Friday'})).toBeNull();
 view.unmount();expect(disconnect).toHaveBeenCalled();vi.unstubAllGlobals();
});

it.each(['/black80','/black80/'])('shows only the pinned compact bar immediately on the promotion page: %s',path=>{
 render(<MemoryRouter initialEntries={[path]}><Black80Banner/></MemoryRouter>);
 expect(screen.queryByRole('complementary',{name:'Promoção Black Friday'})).toBeNull();
 expect(screen.getByRole('complementary',{name:'Resumo da oferta Black Friday'})).toHaveClass('fixed','top-0');
 expect(screen.getAllByRole('complementary')).toHaveLength(1);
 expect(screen.getByRole('timer')).toHaveTextContent('Termina em');
});
