import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
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
 expect(screen.getByRole('complementary')).toHaveStyle({background:'linear-gradient(110deg, #4c1d95 0%, #7e22ce 45%, #a21caf 100%)'});
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
