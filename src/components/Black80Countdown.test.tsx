import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render,screen} from '@testing-library/react';
import Black80Countdown,{black80TimeRemaining} from './Black80Countdown';
afterEach(()=>{cleanup();vi.useRealTimers()});
it('counts down to the actual end of Dec 5 in Brasilia, without restarting on remount',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-05T23:59:58-03:00'));
 expect(black80TimeRemaining(Date.now())).toMatchObject({seconds:2,expired:false});
 const expire=vi.fn();const r=render(<Black80Countdown onExpire={expire}/>);
 expect(screen.getByRole('timer')).toHaveAccessibleName(/2 segundos/);
 act(()=>vi.advanceTimersByTime(1000));expect(screen.getByRole('timer')).toHaveAccessibleName(/1 segundos/);
 r.unmount();render(<Black80Countdown onExpire={expire}/>);
 expect(screen.getByRole('timer')).toHaveAccessibleName(/1 segundos/);
 act(()=>vi.advanceTimersByTime(1000));expect(screen.getByRole('status')).toHaveTextContent('Promoção encerrada');
 act(()=>vi.advanceTimersByTime(3000));expect(expire).toHaveBeenCalledTimes(1);
});
it('uses the server offset and correctly splits days, hours, minutes and seconds',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-04T00:00:00-03:00'));
 expect(black80TimeRemaining(Date.now())).toMatchObject({days:2,hours:0,minutes:0,seconds:0});
 render(<Black80Countdown serverOffsetMs={3600000}/>);
 expect(screen.getByRole('timer')).toHaveAccessibleName(/1 dias, 23 horas, 0 minutos e 0 segundos/);
});
