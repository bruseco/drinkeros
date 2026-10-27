import { useRef, type Ref } from 'react';
import { ArrowDown, ArrowRight, Check } from 'lucide-react';
import drinksStrip from '@/assets/1000-drinks.jpg';
import './clubeVariantBHero.css';
import { useViewportMotion } from './useViewportMotion';

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
  const motionRef = useRef<HTMLDivElement>(null);
  const motionActive = useViewportMotion(motionRef);
  return <div className="club-b-hero-content" ref={motionRef} data-motion-active={motionActive}>
    <img className="club-b-hero-logo" src="/club-landing/logo.png" alt="Clube dos Drinkeros" width="500" height="140" fetchPriority="high" />
    <h1>Mais de <strong>1.000 receitas de drinks.</strong></h1>
    <p className="club-b-hero-categories" ref={pocketRef}>{[
      ['Caipirinhas', '#71cb55'], ['Batidas', '#f04b91'], ['Xaropes artesanais', '#c568ff'],
      ['Frozens', '#36d9e3'], ['Clássicos e variações', '#ffd68a'], ['Shots', '#ff963c'], ['Drinks de galera', '#f04b91'],
    ].map(([label, color]) => <span key={label} style={{ color }}>{label}</span>)}</p>
    <div className="club-b-hero-loop" role="img" aria-label="Uma seleção de drinks do Clube dos Drinkeros"><div>{[0, 1].map(copy => <img key={copy} src={drinksStrip} alt="" width="1200" height="150" />)}</div></div>
    <p className="club-b-hero-subtitle">Pesquise os drinks por ingredientes.</p>
    <div className="club-b-hero-offer">
      <p className="club-b-hero-price"><strong>R$ {price}</strong></p>
      <p className="club-b-hero-access">Um ano de acesso para aproveitar todos esses benefícios.</p>
    </div>
    <button type="button" className="club-b-hero-cta" disabled={loading} onClick={onSubscribe}>
      <span>{loading ? 'Abrindo checkout…' : 'Quero entrar p/ o Clube'}</span>
      <span className="club-b-hero-icons" aria-hidden="true"><ArrowRight /><svg viewBox="0 0 24 32" fill="currentColor"><path fillRule="evenodd" d="M2 3h13v2H4v24h4v2H0v-2h2V3Zm6-2 14 4v26l-14-4V1Zm4 13a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /></svg></span>
    </button>
    <ul className="club-b-hero-benefits">{['Mais de 1.000 receitas em vídeo', 'Mais de 40 xaropes artesanais', 'Até 80% de desconto nos cursos', 'Organizador de festas — escolha os drinks e o número de pessoas. O sistema calcula quanto comprar.'].map(text => <li key={text}><Check aria-hidden="true" />{text}</li>)}</ul>
    <ArrowDown className="club-b-hero-down" aria-hidden="true" />
  </div>;
}
