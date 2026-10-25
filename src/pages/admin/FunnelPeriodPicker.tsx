import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {customFunnelBounds,type FunnelDates,type FunnelRange} from '@/lib/funnelPeriod';
const options=[['today','Hoje'],['7d','7 dias'],['30d','30 dias'],['all','Tudo']] as const;
export default function FunnelPeriodPicker({range,dates,onChange}:{range:FunnelRange;dates:FunnelDates;onChange:(range:FunnelRange,dates:FunnelDates)=>void}){
 const [open,setOpen]=useState(range==='custom');
 const [draft,setDraft]=useState(dates);
 const valid=!!customFunnelBounds(draft);
 return <div className="space-y-3">
  <div className="flex gap-1.5 flex-wrap" aria-label="Período das métricas">{options.map(([key,label])=><Button key={key} size="sm" variant={range===key?'default':'outline'} aria-pressed={range===key} onClick={()=>{setOpen(false);onChange(key,dates)}}>{label}</Button>)}<Button size="sm" variant={open||range==='custom'?'default':'outline'} aria-expanded={open} onClick={()=>{setDraft(dates);setOpen(!open)}}>Personalizado</Button></div>
  {open&&<div className="flex items-end gap-3 flex-wrap rounded-lg border p-3">
   <label className="text-xs space-y-1">Data inicial<Input type="date" aria-label="Data inicial" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label>
   <label className="text-xs space-y-1">Data final<Input type="date" aria-label="Data final" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label>
   <Button size="sm" disabled={!valid} onClick={()=>onChange('custom',draft)}>Aplicar período</Button>
   {!valid&&<p className="w-full text-xs text-muted-foreground">Escolha as duas datas, com a data final igual ou posterior à inicial.</p>}
  </div>}
  {range==='custom'&&customFunnelBounds(dates)&&<p className="text-xs text-muted-foreground">De {dates.from.split('-').reverse().join('/')} até {dates.to.split('-').reverse().join('/')} · inclui o dia final, no horário deste dispositivo.</p>}
 </div>;
}
