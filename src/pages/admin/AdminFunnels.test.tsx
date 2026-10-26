import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import AdminFunnels from './AdminFunnels';
const mocks=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('@/hooks/usePageFunnel',()=>({usePageFunnel:mocks.query}));
afterEach(cleanup);
it('shows Club counts, bars and a detail link on the overview with a shared period filter',()=>{
 mocks.query.mockImplementation((funnel)=>({data:funnel.key==='clube-receitas'?{pageview:100,scroll_50:80,offer_viewed:70,discount:60,checkout:20,purchase:8}:{},isLoading:false,isError:false}));
 render(<MemoryRouter><AdminFunnels/></MemoryRouter>);const card=screen.getByRole('heading',{name:'Funil Clube dos Drinkeros — teste A'}).closest('article')!;const bars=within(card).getAllByRole('meter');expect(bars).toHaveLength(6);expect(bars[0]).toHaveAttribute('aria-valuenow','100');expect(bars[1]).toHaveAttribute('aria-valuenow','80');expect(bars[2]).toHaveAttribute('aria-valuenow','70');expect(bars[3]).toHaveAttribute('aria-valuenow','60');expect(bars[4]).toHaveAttribute('aria-valuenow','20');expect(bars[5]).toHaveAttribute('aria-valuenow','8');expect(within(card).getByText(/60\.0%/)).toBeInTheDocument();expect(within(card).getByRole('link',{name:'Ver métricas →'})).toHaveAttribute('href','/admin/funis/clube-receitas?periodo=30d');fireEvent.click(screen.getByRole('button',{name:'7 dias'}));expect(mocks.query.mock.calls.at(-1)?.[1]).toBe('7d');
});
it('shows a query error instead of inventing zero results',()=>{
 mocks.query.mockReturnValue({isLoading:false,isError:true});render(<MemoryRouter><AdminFunnels/></MemoryRouter>);expect(screen.getAllByRole('alert')).toHaveLength(4);expect(screen.queryByRole('meter')).not.toBeInTheDocument();
});
