import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import FunnelPeriodPicker from './FunnelPeriodPicker';
afterEach(cleanup);
it('applies a valid custom interval explicitly and keeps presets available',()=>{
 const change=vi.fn();render(<FunnelPeriodPicker range="30d" dates={{from:'',to:''}} onChange={change}/>);
 fireEvent.click(screen.getByRole('button',{name:'Personalizado'}));expect(screen.getByRole('button',{name:'Aplicar período'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Data inicial'),{target:{value:'2026-10-01'}});fireEvent.change(screen.getByLabelText('Data final'),{target:{value:'2026-10-25'}});
 expect(change).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Aplicar período'}));expect(change).toHaveBeenCalledWith('custom',{from:'2026-10-01',to:'2026-10-25'});
 fireEvent.click(screen.getByRole('button',{name:'7 dias'}));expect(change).toHaveBeenLastCalledWith('7d',{from:'',to:''});
});
