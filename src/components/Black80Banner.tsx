import {useEffect,useRef,useState} from 'react';
import Black80Countdown from './Black80Countdown';
import {ArrowRight, Sparkles} from 'lucide-react';
import {Link,useLocation} from 'react-router-dom';
import {useBlack80} from '@/hooks/useBlack80';

/** Presentation is separate so a local preview cannot enable prices or payments. */
export function Black80BannerContent({serverOffsetMs=0,onExpire}:{serverOffsetMs?:number;onExpire?:()=>unknown}={}) {
 const bannerRef=useRef<HTMLDivElement>(null);
 const [compact,setCompact]=useState(false);
 useEffect(()=>{
  const banner=bannerRef.current;
  if(!banner || typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(([entry])=>setCompact(!entry.isIntersecting && entry.boundingClientRect.bottom<=0),{threshold:0});
  observer.observe(banner);
  return()=>observer.disconnect();
 },[]);
 return <><div ref={bannerRef}><aside aria-label="Promoção Black Friday" className="relative z-[60] overflow-hidden border-b border-fuchsia-300/40 text-white shadow-[0_6px_30px_rgba(219,39,119,0.3)]" style={{background:'linear-gradient(110deg, #9d174d 0%, #db2777 45%, #ec4899 100%)'}}>
  <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-16 h-64 w-64 rounded-full bg-fuchsia-300/20 blur-3xl"/>
  <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:gap-6 sm:px-6 lg:py-5">
   <div className="flex items-center gap-3 sm:gap-5">
    <div className="flex shrink-0 flex-col items-center rounded-xl border border-white/25 bg-white/10 px-3 py-2 shadow-inner sm:px-4"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-pink-100">Black Friday</span><strong className="text-3xl font-black leading-none sm:text-4xl">80<span className="text-xl">%</span></strong><span className="text-xs font-black tracking-[.22em]">OFF</span></div>
    <div><div className="mb-1 flex items-center gap-2"><Sparkles aria-hidden="true" className="h-4 w-4 text-yellow-300"/><span className="text-xs font-bold uppercase tracking-[.16em] text-pink-100">Black Friday Drinkeros</span></div>
     <p className="text-lg font-extrabold leading-tight sm:text-xl lg:text-2xl">Seus próximos drinks começam aqui.</p>
     <p className="mt-1 text-sm text-pink-100"><strong className="font-black text-yellow-200">BLACK80</strong> · 80% de desconto até <strong>05/12</strong></p>
    </div>
   </div>
   <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:shrink-0">
    <Black80Countdown serverOffsetMs={serverOffsetMs} onExpire={onExpire}/>
    <Link to="/black80" className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-7 py-3 text-sm font-black text-pink-900 shadow-lg transition hover:bg-pink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto">VER OFERTAS <ArrowRight aria-hidden="true" className="h-5 w-5"/></Link>
    <p className="text-center text-[11px] leading-snug text-pink-100">RAND e Clube mensal não participam.<br className="hidden sm:block"/>{' '}Clube anual por <strong className="text-white">R$47</strong>.</p>
   </div>
  </div>
 </aside></div>
 {compact&&<aside aria-label="Resumo da oferta Black Friday" className="fixed inset-x-0 top-0 z-[70] border-b border-pink-300/40 bg-pink-600 text-white shadow-lg">
  <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
   <div className="min-w-0"><p className="text-sm font-black sm:text-base">BLACK80 · 80% OFF <span className="hidden sm:inline">nos produtos participantes</span></p>
    <p className="text-[11px] leading-snug sm:text-xs">Até 05/12, às 23h59 · Brasília <span className="hidden sm:inline">· Clube anual R$47 · RAND e mensal fora</span></p>
   </div>
   <Link to="/black80" className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-pink-900 sm:text-sm">Ver ofertas <ArrowRight aria-hidden="true" className="h-4 w-4"/></Link>
  </div>
 </aside>}</>;
}

export default function Black80Banner({member=false}:{member?:boolean}) {
 const campaign=useBlack80(),{pathname}=useLocation();
 // All customer-facing routes, including login, quiz, checkout and RAND.
 // On RAND the explicit exception remains visible; its price never changes.
 if(!campaign.active || pathname.startsWith('/admin') || pathname.startsWith('/fechamentos') || (!member && (pathname==='/app'||pathname.startsWith('/app/'))))return null;
 return <Black80BannerContent key={pathname} serverOffsetMs={campaign.serverOffsetMs} onExpire={campaign.refresh}/>;
}
