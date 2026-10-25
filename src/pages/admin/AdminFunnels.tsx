import React, {useState} from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Filter } from 'lucide-react';
import { FUNNELS, type FunnelDef } from '@/lib/funnels';
import {usePageFunnel, type FunnelRange} from '@/hooks/usePageFunnel';
import FunnelPeriodPicker from './FunnelPeriodPicker';
import {EMPTY_FUNNEL_DATES,funnelPeriodQuery,type FunnelDates} from '@/lib/funnelPeriod';

const fmt=(value:number)=>value.toLocaleString('pt-BR');
function FunnelSummaryCard({funnel,range,dates}:{funnel:FunnelDef;range:FunnelRange;dates:FunnelDates}){
 const {data:counts,isLoading,isError}=usePageFunnel(funnel,range,dates);
 const top=counts?.[funnel.steps[0]?.key]??0;
 return <article className="rounded-lg border p-5 space-y-4">
  <div className="flex items-start justify-between gap-3">
   <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary shrink-0"/><h2 className="text-lg font-semibold">{funnel.name}</h2></div>
   <a href={funnel.publicPath} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0" aria-label={`Abrir página de ${funnel.name}`}><ExternalLink className="h-4 w-4"/></a>
  </div>
  {isLoading&&!counts?<p className="text-sm text-muted-foreground py-6" role="status">Carregando métricas…</p>:isError&&!counts?<p className="text-sm text-destructive" role="alert">Não foi possível carregar as métricas.</p>:<div className="space-y-3">{funnel.steps.map(step=>{
   const count=counts?.[step.key]??0;const percent=top>0?count/top*100:0;
   return <div key={step.key}>
    <div className="flex justify-between items-start gap-3 text-xs mb-1"><span className="min-w-0">{step.label}</span><span className="shrink-0 font-semibold tabular-nums">{fmt(count)} <span className="font-normal text-muted-foreground">· {top?`${percent.toFixed(1)}%`:'—'}</span></span></div>
    <div className="h-2 rounded-full bg-muted/50 overflow-hidden" role="meter" aria-label={step.label} aria-valuemin={0} aria-valuemax={Math.max(top,count,1)} aria-valuenow={count} aria-valuetext={`${fmt(count)}${top?`, ${percent.toFixed(1)}% dos acessos`:''}`}><div className="h-full rounded-full bg-primary transition-[width]" style={{width:`${Math.min(100,Math.max(0,percent))}%`}}/></div>
   </div>
  })}</div>}
  <Link to={`/admin/funis/${funnel.key}?${funnelPeriodQuery(range,dates)}`} className="inline-flex text-sm font-medium text-primary hover:underline">Ver métricas →</Link>
 </article>;
}
const AdminFunnels: React.FC=()=>{
 const [range,setRange]=useState<FunnelRange>('30d');
 const [dates,setDates]=useState(EMPTY_FUNNEL_DATES);
 return <div className="space-y-6">
  <div className="flex justify-between items-start gap-4 flex-wrap"><div><h1 className="text-3xl font-bold text-foreground">Métricas de Funil</h1><p className="text-muted-foreground">Veja os resultados de cada etapa. Os percentuais comparam cada etapa aos acessos iniciais.</p></div><FunnelPeriodPicker range={range} dates={dates} onChange={(r,d)=>{setRange(r);setDates(d)}}/></div>
  <div className="grid gap-4 xl:grid-cols-2">{FUNNELS.map(funnel=><FunnelSummaryCard key={funnel.key} funnel={funnel} range={range} dates={dates}/>)}</div>
  <p className="text-xs text-muted-foreground">Atualização automática a cada 30 segundos. Abra “Ver métricas” para analisar os detalhes.</p>
 </div>;
};
export default AdminFunnels;
