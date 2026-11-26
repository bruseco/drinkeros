import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Black80Banner from './Black80Banner';
const m=vi.hoisted(()=>({active:true}));
vi.mock('@/hooks/useBlack80',()=>({useBlack80:()=>({active:m.active})}));
afterEach(()=>{cleanup();m.active=true});
it('shows clear exceptions and a catalog link for logged-in users',()=>{
 render(<MemoryRouter initialEntries={['/app']}><Black80Banner member/></MemoryRouter>);
 expect(screen.getByRole('link')).toHaveAttribute('href','/black80');
 expect(screen.getByText(/Exceto RAND e Clube mensal. Clube anual: R\$47./)).toBeInTheDocument();
});
it('stays hidden when disabled and on the excluded RAND sales page',()=>{
 const r=render(<MemoryRouter initialEntries={['/rand']}><Black80Banner/></MemoryRouter>);
 expect(screen.queryByRole('link')).toBeNull();r.unmount();m.active=false;
 render(<MemoryRouter initialEntries={['/mixologia-avancada']}><Black80Banner/></MemoryRouter>);
 expect(screen.queryByRole('link')).toBeNull();
});
