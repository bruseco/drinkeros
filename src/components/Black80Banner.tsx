import {Link,useLocation} from 'react-router-dom';
import {useBlack80} from '@/hooks/useBlack80';
const publicPaths=new Set(['/black80','/clube-receitas','/pv-clube-b','/drinkeros-xperience','/mixologia-avancada','/bar-p-eventos','/drinkdelivery-engarrafados','/ingredientes-artesanais','/classicos-destilados','/bartender-a-bordo','/bebida-decifrada','/workshop-alem-dos-classicos']);
const excluded=new Set(['/app','/admin','/login','/signup','/quiz','/install','/reset-password','/create-account','/sso','/migracao','/complete-profile','/politica-de-privacidade','/termos-de-uso']);
export default function Black80Banner({member=false}:{member?:boolean}) {
 const campaign=useBlack80(),{pathname}=useLocation();
 const catalogSlug=/^\/[^/]+$/.test(pathname)&&!excluded.has(pathname);
 if(!campaign.active || (!member && !catalogSlug && !publicPaths.has(pathname) && !pathname.startsWith('/quiz-') && !pathname.startsWith('/checkout/') && !pathname.startsWith('/ebook/')))return null;
 if(pathname.includes('/rand'))return null;
 return <aside aria-label="Promoção Black Friday" className="relative z-30 border-b border-yellow-400/40 bg-black px-4 py-3 text-center text-sm text-white">
  <Link to="/black80" className="block"><strong className="text-yellow-300">BLACK80 · BLACK FRIDAY</strong> — 80% OFF nos produtos Drinkeros.<br className="sm:hidden"/>{' '}<span className="text-white/80">Até 05/12 · Exceto RAND e Clube mensal. Clube anual: R$47.</span>{' '}<span className="font-bold underline underline-offset-4">Ver ofertas</span></Link>
 </aside>;
}
