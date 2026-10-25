import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {sinceFromRange,type FunnelRange} from '@/hooks/usePageFunnel';
import {QUESTIONS,type QuestionId} from '@/lib/quizLogic';
import {Button} from '@/components/ui/button';
type AnswerCount={question:string;answer:string|null;count:number};
const format=(n:number)=>n.toLocaleString('pt-BR');
export default function QuizAnswerMetrics({range}:{range:FunnelRange}){
 const {data,isLoading,isError,refetch}=useQuery({queryKey:['quiz-answer-metrics',range],refetchInterval:30000,queryFn:async()=>{
  const {data,error}=await supabase.rpc('get_quiz_answer_metrics' as never,{_since:sinceFromRange(range)} as never);
  if(error)throw error;
  return (data??[]) as AnswerCount[];
 }});
 return <section className="space-y-4" aria-labelledby="quiz-answer-heading">
  <div><h2 id="quiz-answer-heading" className="text-xl font-semibold">Respostas por pergunta</h2><p className="text-sm text-muted-foreground">Contagens por sessão no período selecionado. Os percentuais usam o total de respostas da própria pergunta.</p></div>
  {isLoading&&!data?<p className="text-sm text-muted-foreground">Carregando respostas…</p>:isError?<div role="alert" className="rounded-lg border p-4"><p>Não foi possível carregar as respostas do quiz.</p><Button variant="outline" size="sm" className="mt-2" onClick={()=>void refetch()}>Tentar novamente</Button></div>:<div className="grid gap-4 xl:grid-cols-2">{(Object.keys(QUESTIONS) as QuestionId[]).map((id,index)=>{
   const question=QUESTIONS[id],rows=(data??[]).filter(row=>row.question===id);
   const total=rows.reduce((sum,row)=>sum+Number(row.count),0);
   const unknown=rows.filter(row=>!question.options.some(option=>option.key===row.answer)).reduce((sum,row)=>sum+Number(row.count),0);
   return <article key={id} className="rounded-xl border p-5 space-y-4" aria-labelledby={`quiz-answer-${id}`}>
    <div><h3 id={`quiz-answer-${id}`} className="font-semibold">{index+1}. {question.title}</h3><p className="text-xs text-muted-foreground mt-1">{format(total)} respostas{id==='q4'?' · Pergunta condicional: interesse em empreender':''}</p></div>
    {total===0?<p className="text-sm text-muted-foreground">Sem respostas no período.</p>:question.options.map(option=>{
     const count=rows.filter(row=>row.answer===option.key).reduce((sum,row)=>sum+Number(row.count),0),percent=total?count/total*100:0;
     return <div key={option.key} className="space-y-2"><div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0">{option.key}. {option.label}</span><span className="shrink-0 text-right"><strong>{format(count)}</strong><span className="block text-xs text-muted-foreground">{percent.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</span></span></div><div role="meter" aria-label={`${id.toUpperCase()} · ${option.label}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={count} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${percent}%`}}/></div></div>;
    })}
    {unknown>0&&<p className="text-xs text-muted-foreground">{format(unknown)} respostas sem alternativa identificada, incluídas no total.</p>}
   </article>;
  })}</div>}
 </section>;
}
