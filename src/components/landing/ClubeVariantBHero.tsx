import type { Ref } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import drinksStrip from '@/assets/1000-drinks.jpg';
import './clubeVariantBHero.css';

/** Carry only advertising parameters; checkout's own offer parameter stays authoritative. */
export function preserveClubBAdParams(destination: string, sourceSearch: string): string {
  const [path, query = ''] = destination.split('?');
  const params = new URLSearchParams(query);
  new URLSearchParams(sourceSearch).forEach((value, key) => {
    if (/^utm_/i.test(key) || key === 'fbclid') params.set(key, value);
  });
  const search = params.toString();
  return path + (search ? `?${search}` : '');
}

type Props = { price: number; loading: boolean; onSubscribe: () => void; pocketRef?: Ref<HTMLParagraphElement> };
export default function ClubeVariantBHero({ price, loading, onSubscribe, pocketRef }: Props) {
  return <div className="club-b-hero-content">
    <img className="club-b-hero-logo" src="/club-landing/logo.png" alt="Clube dos Drinkeros" width="500" height="140" fetchPriority="high" />
    <h1>Mais de <strong>1.000 receitas de drinks.</strong></h1>
    <p className="club-b-hero-categories"><span>Caipirinhas</span><span>Batidas</span><span>Xaropes artesanais</span></p>
    <p className="club-b-hero-subtitle">Do drink fácil pra festa ao clássico de bar. Aprende assistindo, faz em casa.</p>
    <div className="club-b-hero-offer">
      <p className="club-b-hero-price"><strong>R$ {price}</strong><span>/ ano</span></p>
    </div>
    <button type="button" className="club-b-hero-cta" disabled={loading} onClick={onSubscribe}>
      <span>{loading ? 'Abrindo checkout…' : 'Quero entrar p/ o Clube'}</span>
      <span className="club-b-hero-icons" aria-hidden="true"><ArrowRight /><svg viewBox="0 0 24 32" fill="currentColor"><path fillRule="evenodd" d="M2 3h13v2H4v24h4v2H0v-2h2V3Zm6-2 14 4v26l-14-4V1Zm4 13a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /></svg></span>
    </button>
    <ul className="club-b-hero-benefits">{['Mais de mil receitas em vídeo', 'Xaropes artesanais', 'Desconto nos cursos Drinkeros'].map(text => <li key={text}><Check aria-hidden="true" />{text}</li>)}</ul>
    <p className="club-b-hero-access" ref={pocketRef}>Um ano de acesso para aproveitar todos esses benefícios.</p>
    <img className="club-b-hero-drinks" src={drinksStrip} alt="Uma seleção de drinks do Clube dos Drinkeros" width="1200" height="150" />
  </div>;
}
