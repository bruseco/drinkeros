import {useEffect,useRef,useState} from 'react';
import {BLACK80_END} from '../../supabase/functions/_shared/black80';
const deadline=Date.parse(BLACK80_END);
export function black80TimeRemaining(now:number) {
 const total=Math.max(0,Math.ceil((deadline-now)/1000));
 return {days:Math.floor(total/86400),hours:Math.floor(total/3600)%24,minutes:Math.floor(total/60)%60,seconds:total%60,expired:total===0};
}
export default function Black80Countdown({serverOffsetMs=0,onExpire,compact=false}:{serverOffsetMs?:number;onExpire?:()=>unknown;compact?:boolean}) {
 const [now,setNow]=useState(Date.now);
 const notified=useRef(false);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[]);
 const remaining=black80TimeRemaining(now+serverOffsetMs);
 useEffect(()=>{if(remaining.expired&&!notified.current){notified.current=true;void onExpire?.()}},[remaining.expired,onExpire]);
 if(remaining.expired)return <p className="text-sm font-bold" role="status">Promoção encerrada</p>;
 return <div role="timer" aria-label={`Faltam ${remaining.days} dias, ${remaining.hours} horas, ${remaining.minutes} minutos e ${remaining.seconds} segundos para o fim da Black Friday`} className={compact?'flex items-center justify-center gap-1.5 sm:gap-3':'flex flex-wrap items-center justify-center gap-2'}>
  <span className={compact?'hidden text-[10px] font-bold uppercase tracking-wider sm:inline':'text-[10px] font-bold uppercase tracking-wider opacity-90'}>Termina em</span>
  <div className={compact?'flex items-center gap-1 sm:gap-1.5':'flex items-center gap-1.5'}>{[[remaining.days,'dias'],[remaining.hours,'horas'],[remaining.minutes,'min'],[remaining.seconds,'seg']].map(([value,label])=><div key={label} className={compact?'min-w-7 rounded-md border border-current/20 bg-black/20 px-1 py-1 text-center sm:min-w-9 sm:px-1.5':'min-w-9 rounded-md border border-current/20 bg-black/20 px-1.5 py-1 text-center'}><strong className={compact?'block text-sm font-black leading-none tabular-nums sm:text-base':'block text-base font-black leading-none tabular-nums'}>{String(value).padStart(2,'0')}</strong><span className={compact?'mt-0.5 block text-[8px] uppercase leading-none opacity-80 sm:text-[9px]':'mt-0.5 block text-[9px] uppercase leading-none opacity-80'}>{label}</span></div>)}</div>
 </div>;
}
