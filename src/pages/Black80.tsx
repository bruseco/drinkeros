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
   let q=(supabase.from as any)(table).select('id,name,slug,price,cover_image_url').eq('is_active',true).gt('price',0).neq('slug','rand').neq('slug','pacote-business');
   if(table!=='ebooks')q=q.eq('is_available_for_sale',true);
   const {data,error}=await q;if(error)throw error;
   return (data||[]).map((p:any)=>({...p,cover_image_url:p.cover_image_url||(p.slug==='pacote-6-e-books'?packCover:null),type:({courses:'course',ebooks:'ebook',combos:'combo',packages:'package'} as Record<string,string>)[table]}));
  }));return groups.flat();
 }});
 return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-6xl">
  <h1 className="text-3xl font-bold text-yellow-400">BLACK80 — Black Friday Drinkeros</h1>
  <p className="mt-3">80% de desconto nos produtos participantes, aplicado automaticamente. Clube anual por R$47. RAND e Clube mensal mantêm suas condições.</p>
  <p className="mt-2 text-sm text-muted-foreground">Válido até 5 de dezembro de 2026, às 23h59 de Brasília. Não cumulativo.</p>
  {!campaign.active?<p role="status" className="mt-8">{campaign.loading?'Conferindo promoção…':'A promoção não está ativa. Os preços regulares continuam valendo.'}</p>:<>
   <Link to="/checkout/club/clube-anual" className="mt-6 block rounded-xl border border-yellow-400 p-5 font-bold">Clube anual: de R$87 por R$47 · 12 meses de acesso →</Link>
   {isLoading&&<p>Carregando produtos…</p>}{error&&<p role="alert">Não foi possível carregar as ofertas. Atualize a página.</p>}
   <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.map((p:any)=><article key={p.type+p.id} className="overflow-hidden rounded-xl border bg-card">
    {p.cover_image_url&&<img src={p.cover_image_url} alt="" loading="lazy" className="h-44 w-full object-contain"/>}<div className="p-5"><h2 className="font-bold">{p.name}</h2><p className="mt-2"><del className="mr-2 text-muted-foreground">{formatBRL(Number(p.price))}</del><strong className="text-xl text-green-500">{formatBRL(campaign.price(p.type,p.slug,Number(p.price)))}</strong></p><Link className="mt-4 block rounded-lg bg-primary p-3 text-center font-bold text-primary-foreground" to={`/checkout/${p.type}/${p.slug}`}>Aproveitar BLACK80 →</Link></div>
   </article>)}</div>
  </>}
 </div></main>;
}
