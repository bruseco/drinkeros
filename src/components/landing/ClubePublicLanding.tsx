import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Heart, Play, ShoppingBag } from 'lucide-react';
import drinksStrip from '@/assets/1000-drinks.jpg';
import TestimonialsCarousel from './TestimonialsCarousel';
import catalog from './clubLandingCatalog.json';
import './clubePublicLanding.css';

export function AnimatedClubCount({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); return; }
    let frame = 0;
    let visible = false;
    const observer = new IntersectionObserver(entries => {
      const next = entries.some(entry => entry.isIntersecting);
      if (next === visible) return;
      visible = next;
      cancelAnimationFrame(frame);
      if (!visible) { setDisplay(0); return; }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 1600, 1);
        setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      setDisplay(0);
      frame = requestAnimationFrame(tick);
    }, { root: element.closest('.club-public'), rootMargin: '0px 0px -18% 0px', threshold: 0.7 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span className={`club-count ${className}`} aria-label={value.toLocaleString('pt-BR')} ref={ref}><span aria-hidden="true">{display.toLocaleString('pt-BR')}</span></span>;
}

type Category = typeof catalog[number];
const DEPTHS = [
  [122, 1, 1, -3], [12, .72, .42, 4], [162, 1, 1, 2], [46, .83, .62, -4], [113, 1, 1, 3],
  [8, .7, .4, -3], [155, .98, 1, -2], [53, .84, .65, 3], [120, 1, 1, -4], [15, .73, .46, 4],
];
const LOOP_WIDTH = 1900;
const SPEEDS = [52, 31.2, 13];

function CategoryScene({ category }: { category: Category }) {
  const scene = useRef<HTMLElement>(null);
  const surfaces = useRef<Array<HTMLDivElement | null>>([]);
  const offsets = useRef([0, 0, 0]);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const move = (distance: number) => {
    surfaces.current.forEach((layer, index) => {
      offsets.current[index] = ((offsets.current[index] + distance * SPEEDS[index] / SPEEDS[0]) % LOOP_WIDTH + LOOP_WIDTH) % LOOP_WIDTH;
      if (layer) layer.style.transform = `translate3d(${-offsets.current[index]}px,0,0)`;
    });
  };
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let previous = 0;
    let frame = 0;
    const tick = (time: number) => {
      const dt = previous ? Math.min(time - previous, 60) / 1000 : 0;
      previous = time;
      if (!media.matches && !dragging.current) move(dt * SPEEDS[0]);
      if (visible) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(entries => {
      const next = entries.some(entry => entry.isIntersecting);
      if (next === visible) return;
      visible = next;
      cancelAnimationFrame(frame);
      if (visible) { previous = 0; frame = requestAnimationFrame(tick); }
    }, { threshold: .02 });
    if (scene.current) observer.observe(scene.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  const cards = (layer: number) => [0, 1].flatMap(cycle => category.recipes.flatMap((recipe, index) => {
    const [y, scale, opacity, rotation] = DEPTHS[index % DEPTHS.length];
    if (layer < 2 && (scale >= .95 ? 0 : 1) !== layer) return [];
    return (layer === 2 ? [0, 1] : [0]).map(ghost => (
      <figure key={`${cycle}-${index}-${ghost}`} style={{
        left: index * 190 + cycle * LOOP_WIDTH + (layer === 2 ? ghost * 98 : 0),
        top: layer === 2 ? (ghost ? 175 + index % 3 * 20 : index % 3 * 34 - 15) : y,
        opacity: layer === 2 ? (ghost ? .10 : .16) : opacity,
        transform: `scale(${layer === 2 ? [.39, .47, .35][index % 3] : scale}) rotate(${rotation}deg)`,
      }} aria-hidden={cycle === 1 || layer === 2 ? true : undefined}>
        <img src={recipe.image} alt={cycle === 1 || layer === 2 ? '' : recipe.title} width="1280" height="720" loading="lazy" decoding="async" draggable={false} />
      </figure>
    ));
  }));
  return <section className={`club-scene${category.id === 'syrups' ? ' club-syrups' : ''}`} ref={scene} aria-label={category.label}>
    <div className="club-stage">
      <div className="club-covers-window" aria-label="Capas das receitas; arraste para explorar"
        onPointerDown={event => { dragging.current = true; lastX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (dragging.current) { move(lastX.current - event.clientX); lastX.current = event.clientX; } }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        {[0, 1, 2].map(layer => <div key={layer} className={`club-depth-layer club-depth-${layer}`} ref={el => { surfaces.current[layer] = el; }}>{cards(layer)}</div>)}
      </div>
      <div className="club-category-copy">
        <h2>{category.number === null ? <>Diversos <strong>shots para curtir.</strong></> : category.label === 'Frozens' ? <><strong><AnimatedClubCount value={20} />+ frozens</strong> para descobrir.</> : <>Mais de <strong><AnimatedClubCount value={category.number} /> {category.id === 'syrups' ? 'receitas de Xaropes Artesanais' : category.label.toLocaleLowerCase('pt-BR')}.</strong></>}</h2>
        <p>{category.subtitle}</p>
      </div>
    </div>
  </section>;
}

type Props = {
  scrollRef: React.Ref<HTMLDivElement>;
  registerPriceCard: (element: HTMLDivElement | null) => void;
  price: React.ReactNode;
  fullPrice: number;
  unlocked: boolean;
  savings: number;
  loading: boolean;
  onSubscribe: () => void;
  reveal: React.ReactNode;
};

export default function ClubePublicLanding(props: Props) {
  const pricing = useRef<HTMLElement>(null);
  const scrollToPricing = () => pricing.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  useEffect(() => {
    const previous = document.title;
    document.title = 'Clube dos Drinkeros · Mais de mil receitas em vídeo';
    return () => { document.title = previous; };
  }, []);
  return <div className={`club-public${props.unlocked ? ' club-unlocked' : ''}`} ref={props.scrollRef}>
    {props.reveal}
    <button type="button" className="club-floating-cta" disabled={props.unlocked && props.loading} onClick={props.unlocked ? props.onSubscribe : scrollToPricing}><span className="club-cta-copy"><span>Quero entrar para o</span><strong>CLUBE</strong></span><ArrowRight aria-hidden="true" /></button>
    <header className="club-public-hero">
      <p className="club-invite">Torne-se membro do</p>
      <h1><img className="club-logo" src="/club-landing/logo.png" alt="Clube dos Drinkeros" width="500" height="140" fetchPriority="high" /></h1>
      <p className="club-pocket">Mais de <strong><AnimatedClubCount value={1000} /></strong> receitas no seu bolso.</p>
      <div className="club-hero-strip" aria-hidden="true"><div><img src={drinksStrip} alt="" /><img src={drinksStrip} alt="" /></div></div>
      <p className="club-discover">Descubra o que espera por você</p>
      <ArrowDown className="club-down" aria-hidden="true" />
    </header>
    {catalog.map(category => <CategoryScene key={category.id} category={category} />)}
    <section className="club-tools" aria-label="Organize seus drinks">
      <div><Play aria-hidden="true" /><h2>Veja como preparar</h2><p>Acompanhe o passo a passo das receitas em vídeo.</p></div>
      <div><Heart aria-hidden="true" /><h2>Salve suas escolhas</h2><p>Monte listas de favoritos para cada ocasião.</p></div>
      <div><ShoppingBag aria-hidden="true" /><h2>Organize a festa</h2><p>Defina pessoas e drinks e gere sua lista de compras.</p></div>
    </section>
    <section id="clube-pricing" className="club-public-pricing" ref={pricing}>
      <p className="club-eyebrow">Seu próximo drink começa aqui</p><h2>Entre para o Clube.</h2>
      <div className="club-offer" ref={props.registerPriceCard}>
        <p>Clube dos Drinkeros · Plano anual</p>
        {props.unlocked && <p className="club-old-price">De R$ {props.fullPrice}</p>}
        <div className="club-price"><span>R$</span> {props.price}<small>/ ano</small></div>
        {props.unlocked && <p className="club-saving">Você economiza R$ {props.savings} agora.</p>}
        <ul><li>Acesso às receitas em vídeo do Clube</li><li>Xaropes artesanais e novas combinações</li><li>Listas de favoritos e listas de compras</li></ul>
        <button type="button" className="club-purchase" disabled={props.loading} onClick={props.onSubscribe}>{props.loading ? 'Abrindo checkout…' : 'Quero entrar para o Clube'}</button>
        <p className="club-payment-note">Pagamento por cartão ou Pix. No cartão, assinatura com renovação automática; no Pix, acesso por 12 meses.</p>
      </div>
    </section>
    <section className="club-public-testimonials"><h2>Olha o que o pessoal acha da gente.</h2><TestimonialsCarousel /></section>
    <section className="club-faq"><h2>Ficou alguma dúvida?</h2>
      <details><summary>Preciso ter experiência?</summary><p>Você pode acompanhar o preparo em vídeo e escolher as receitas que combinam com os ingredientes que tem.</p></details>
      <details><summary>Posso usar no celular?</summary><p>Sim. Acesse o aplicativo pelo navegador do seu celular e salve suas receitas favoritas na sua conta.</p></details>
      <details><summary>Como recebo acesso?</summary><p>Crie sua conta, conclua o pagamento e aguarde a confirmação. O acesso será vinculado à sua conta.</p></details>
    </section>
    <footer className="club-public-footer">Clube dos Drinkeros · Receitas para cada momento.</footer>
  </div>;
}
