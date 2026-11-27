import black80Hero from '@/assets/black80-hero-approved.jpg';
import { black80CourseDetails } from '@/lib/black80CourseDetails';
import Black80Countdown from '@/components/Black80Countdown';
import { ArrowRight, Check, Play, Heart, ListChecks, Users } from 'lucide-react';
import drinksStrip from '@/assets/1000-drinks.jpg';
import packCover from '@/assets/quiz-pack-6-ebooks.jpg';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useBlack80} from '@/hooks/useBlack80';
import {formatBRL} from '@/lib/vipDiscount';
export default function Black80() {
 const campaign=useBlack80();
 const {data=[],isLoading,error}=useQuery({queryKey:['black80-products'],queryFn:async()=>{
  const groups=await Promise.all(['courses','ebooks','combos','packages'].map(async(table)=>{
   let q=(supabase.from as any)(table).select('id,name,slug,price,cover_image_url').eq('is_active',true).gt('price',0).neq('slug','rand').neq('slug','classicos-destilados').neq('slug','pacote-business');
   if(table!=='ebooks')q=q.eq('is_available_for_sale',true);
   const {data,error}=await q;if(error)throw error;
   return (data||[]).map((p:any)=>({...p,cover_image_url:p.cover_image_url||(p.slug==='pacote-6-e-books'?packCover:null),type:({courses:'course',ebooks:'ebook',combos:'combo',packages:'package'} as Record<string,string>)[table]}));
  }));return groups.flat();
 }});
 return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-6xl">
  <h1 className="sr-only">BLACK80 — Black Friday Drinkeros</h1>
  {!campaign.active?<p role="status" className="mt-8">{campaign.loading?'Conferindo promoção…':'A promoção não está ativa. Os preços regulares continuam valendo.'}</p>:<>
   <img src={black80Hero} alt="Black Friday Drinkeros. BLACK80: 80% OFF nos cursos e e-books participantes. Clube anual por R$47. Até 5 de dezembro, às 23h59 de Brasília." width="1983" height="793" fetchPriority="high" className="block h-auto w-full rounded-2xl border border-pink-400/30" />
   <p className="sr-only">Desconto aplicado automaticamente. Oferta não cumulativa.</p>
   <div className="mt-5 w-fit rounded-xl border border-pink-400/40 bg-pink-950 px-4 py-3 text-white"><Black80Countdown serverOffsetMs={campaign.serverOffsetMs} onExpire={campaign.refresh}/></div>
   <section aria-labelledby="black80-club" className="relative mt-8 overflow-hidden rounded-3xl border border-purple-400/40 bg-gradient-to-br from-purple-950 via-purple-900 to-fuchsia-950 shadow-2xl shadow-purple-950/40">
    <div className="grid items-center gap-5 p-5 sm:p-6 md:grid-cols-[1.2fr_1fr_1fr]">
     <div>
      <img src="/club-landing/logo.png" alt="Clube dos Drinkeros" className="mb-3 w-44 max-w-full" />
      <h2 id="black80-club" className="text-2xl font-black leading-tight text-white sm:text-3xl">Mais de <span className="text-yellow-300">1.000 receitas</span> no seu aplicativo.</h2>
      <p className="mt-3 text-sm text-purple-100">Drinks para cada ocasião, com o preparo em vídeo.</p>
     </div>
     <ul className="space-y-2 text-sm text-white">{[
      [Play, 'Mais de 1.000 receitas em vídeo'], [Check, 'Mais de 40 xaropes artesanais'],
      [ListChecks, 'Organizador de festas e lista de compras'], [Heart, 'Suas receitas favoritas'], [Users, 'Comunidade de receitas'],
     ].map(([Icon,text]) => { const FeatureIcon=Icon as typeof Play; return <li key={String(text)} className="flex items-start gap-2"><FeatureIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300"/><span>{String(text)}</span></li>; })}</ul>
     <div className="rounded-xl border border-white/15 bg-black/20 p-4">
      <p className="text-xs font-semibold text-purple-200">BLACK FRIDAY · PLANO ANUAL</p>
      <p className="mt-2 text-white"><del className="mr-2 text-sm text-purple-300">R$87</del><strong className="text-4xl font-black">R$47</strong><span className="ml-1 text-sm text-purple-100">/ ano</span></p>
      <p className="mt-1 text-xs text-purple-100">12 meses de acesso ao aplicativo</p>
      <Link to="/checkout/club/clube-anual" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-lg bg-yellow-300 px-3 py-3 text-center text-sm font-bold text-purple-950 transition-colors hover:bg-yellow-200">Quero entrar para o Clube <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0"/></Link>
      <p className="mt-2 text-center text-xs text-purple-200">15 dias de garantia para experimentar com tranquilidade.</p>
     </div>
    </div>
    <img src={drinksStrip} alt="Uma seleção de drinks do Clube" className="h-14 w-full object-cover sm:h-16" />
   </section>
   {isLoading&&<p>Carregando produtos…</p>}{error&&<p role="alert">Não foi possível carregar as ofertas. Atualize a página.</p>}
   {[
    {title:'Cursos',description:'Aprenda novas técnicas e dê o próximo passo na coquetelaria.',items:data.filter((p:any)=>p.type==='course')},
    {title:'E-books',description:'Suas próximas receitas favoritas, reunidas para consultar quando quiser.',items:data.filter((p:any)=>p.type==='ebook'||p.slug==='pacote-6-e-books')},
    {title:'Pacotes',description:'Mais conteúdo para ampliar seu repertório.',items:data.filter((p:any)=>p.type!=='course'&&p.type!=='ebook'&&p.slug!=='pacote-6-e-books')},
   ].filter(group=>group.items.length>0).map(group=><section key={group.title} className="mt-14 border-t border-purple-400/20 pt-9" aria-label={group.title}>
    <h2 className="text-4xl font-black tracking-tight sm:text-5xl">{group.title}</h2><p className="mt-3 text-muted-foreground">{group.description}</p>
    <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{group.items.map((p:any)=><article key={p.type+p.id} className="overflow-hidden rounded-xl border bg-card">
    {p.cover_image_url&&<img src={p.cover_image_url} alt="" loading="lazy" className={p.type==='course'?'block h-auto w-full object-contain object-center':'h-56 w-full object-contain object-center'}/>}<div className="p-5"><h3 className="font-bold">{p.name}</h3>{p.type==='course'&&black80CourseDetails[p.slug]&&<p className="mt-3 text-sm leading-relaxed text-muted-foreground">{black80CourseDetails[p.slug].description}</p>}<p className="mt-2"><del className="mr-2 text-muted-foreground">{formatBRL(Number(p.price))}</del><strong className="text-xl text-green-500">{formatBRL(campaign.price(p.type,p.slug,Number(p.price)))}</strong></p><Link className="mt-4 block rounded-lg bg-primary p-3 text-center font-bold text-primary-foreground" to={`/checkout/${p.type}/${p.slug}`}>Aproveitar BLACK80 →</Link>{p.type==='course'&&black80CourseDetails[p.slug]?.path&&<Link className="mt-3 block rounded-lg border border-purple-400/40 px-3 py-3 text-center text-sm font-semibold hover:bg-purple-500/10" to={black80CourseDetails[p.slug].path!}>Ver mais detalhes</Link>}</div>
   </article>)}</div></section>)}
  </>}
 </div></main>;
}
