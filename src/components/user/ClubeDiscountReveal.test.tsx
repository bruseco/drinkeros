import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ClubeDiscountReveal from './ClubeDiscountReveal';
import {getFunnel} from '@/lib/funnels';
vi.mock('@/components/landing/useViewportMotion',()=>({useViewportMotion:()=>true}));
vi.mock('@/hooks/useYouthDiscount',()=>({useYouthDiscount:()=>({isYouth:false})}));
beforeEach(()=>vi.useFakeTimers());afterEach(()=>{cleanup();vi.useRealTimers()});
it('closing the gift before claiming does not claim the public discount',()=>{
 const close=vi.fn();render(<ClubeDiscountReveal open onClose={close} newVisitor/>);fireEvent.click(screen.getByRole('button',{name:'Fechar'}));act(()=>vi.advanceTimersByTime(350));expect(close).toHaveBeenCalledWith(false);
});
it('claiming the public offer completes the gift before applying the discount',()=>{
 const close=vi.fn();render(<ClubeDiscountReveal open onClose={close} newVisitor/>);fireEvent.click(screen.getByRole('button',{name:'Pegar desconto'}));act(()=>vi.advanceTimersByTime(5500));expect(close).not.toHaveBeenCalled();act(()=>vi.advanceTimersByTime(100));expect(close).toHaveBeenCalledWith(true);
});
it('keeps a claimed offer when the animation is dismissed early',()=>{
 const close=vi.fn();render(<ClubeDiscountReveal open onClose={close} newVisitor/>);fireEvent.click(screen.getByRole('button',{name:'Pegar desconto'}));fireEvent.click(screen.getByRole('button',{name:'Fechar'}));act(()=>vi.advanceTimersByTime(350));expect(close).toHaveBeenCalledWith(true);
});
it('exposes the three requested stages under a separate Club funnel',()=>{
 const funnel=getFunnel('clube-receitas')!;expect(funnel.name).toBe('Funil Clube dos Drinkeros');expect(funnel.publicPath).toBe('/clube-receitas');expect(funnel.steps.map(s=>s.event)).toEqual(['pageview','offer_1_revealed','checkout_1_started']);
});

it('announces the R$110 discount before the gift is claimed',()=>{
 render(<ClubeDiscountReveal open onClose={vi.fn()} newVisitor savings={110}/>);expect(screen.getByText('R$ 110 de desconto')).toBeVisible();expect(screen.queryByText('O que tem dentro?')).toBeNull();expect(screen.getByRole('button',{name:'Pegar desconto'})).toBeVisible();
});
