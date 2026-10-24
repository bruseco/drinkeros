import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Heart, Play, ShoppingBag } from 'lucide-react';
import drinksStrip from '@/assets/1000-drinks.jpg';
import drinkerosLogo from '@/assets/logotipo-drinkeros.png';
import { Link } from 'react-router-dom';
import payVisa from '@/assets/pagamento-visa.png';
import payMaster from '@/assets/pagamento-mastercard.png';
import payApple from '@/assets/pagamento-apple.png';
import payGoogle from '@/assets/pagamento-google.png';
import payPix from '@/assets/pagamento-pix.png';
import TestimonialsCarousel from './TestimonialsCarousel';
import catalog from './clubLandingCatalog.json';
import './clubePublicLanding.css';
import { useIntroCountdown } from '@/hooks/useClubeIntroOffer';

export function AnimatedClubCount({ value, className = '', start = true, onComplete }: { value: number; className?: string; start?: boolean; onComplete?: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!start) { setDisplay(0); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisplay(value); onComplete?.(); return; }
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
        else onComplete?.();
      };
      setDisplay(0);
      frame = requestAnimationFrame(tick);
    }, { root: element.closest('.club-public'), rootMargin: '0px 0px -18% 0px', threshold: 0.7 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value, start, onComplete]);
  return <span className={`club-count ${className}`} data-started={display > 0} aria-label={value.toLocaleString('pt-BR')} ref={ref}><span aria-hidden="true">{display.toLocaleString('pt-BR')}</span></span>;
}

type Category = typeof catalog[number];
const DEPTHS = [
  [122, 1, 1, -3], [12, .72, .42, 4], [162, 1, 1, 2], [46, .83, .62, -4], [113, 1, 1, 3],
  [8, .7, .4, -3], [155, .98, 1, -2], [53, .84, .65, 3], [120, 1, 1, -4], [15, .73, .46, 4],
];
const LOOP_WIDTH = 1900;
const SPEEDS = [52, 31.2, 13];

function CategoryScene({ category, direction, onCoversReached }: { category: Category; direction: 1 | -1; onCoversReached?: () => void }) {
  const scene = useRef<HTMLElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const subtitle = useRef<HTMLParagraphElement>(null);
  const covers = useRef<HTMLDivElement>(null);
  const [countReady, setCountReady] = useState(false);
  const [highlighted,setHighlighted]=useState(false);
  const handleCountComplete=React.useCallback(()=>{setHighlighted(true)},[]);
  useEffect(()=>{if(!countReady)setHighlighted(false);else if(category.number===null)setHighlighted(true)},[countReady,category.number]);
  const surfaces = useRef<Array<HTMLDivElement | null>>([]);
  const offsets = useRef([0, 0, 0]);
  const dragging = useRef(false);
  const lastX = useRef(0);
  useEffect(() => {
    const scroller = scene.current?.closest('.club-public');
    if (!scroller) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let ready = false;
    let ctaRevealed = false;
    const update = () => {
      frame = 0;
      const viewport = scroller.getBoundingClientRect();
      const width = viewport.width;
      const position = (element: HTMLElement | null) => {
        if (!element) return 0;
        const top = element.getBoundingClientRect().top - viewport.top;
        const progress = media.matches ? 0 : Math.max(0, Math.min(1, (top - viewport.height * .55) / (viewport.height * .45)));
        element.style.transform = `translate3d(${direction * progress * width * .9}px,0,0)`;
        element.style.opacity = String(1 - progress);
        return progress;
      };
      const progress = position(heading.current);
      position(subtitle.current);
      position(covers.current);
      const next = progress === 0 && !!scene.current && scene.current.getBoundingClientRect().bottom > viewport.top;
      if (next !== ready) { ready = next; setCountReady(next); }
      const headingBounds = heading.current?.getBoundingClientRect();
      const coversBounds = covers.current?.getBoundingClientRect();
      if (!ctaRevealed && headingBounds && coversBounds && headingBounds.bottom <= viewport.top && coversBounds.top + coversBounds.height / 2 <= viewport.top + viewport.height * .15) {
        ctaRevealed = true;
        onCoversReached?.();
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    media.addEventListener('change', onScroll);
    update();
    return () => { scroller.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); media.removeEventListener('change', onScroll); cancelAnimationFrame(frame); };
  }, [direction, onCoversReached]);
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
      if (!media.matches && !dragging.current) move(dt * SPEEDS[0] * direction);
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
  }, [direction, onCoversReached]);
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
  return <section className={`club-scene${category.id === 'syrups' ? ' club-syrups' : ''}${highlighted ? ' club-highlight-complete' : ''}`} ref={scene} aria-label={category.label}>
    <div className="club-stage">
      <div className="club-category-copy club-category-heading" ref={heading}>
        <h2>{category.number === null ? <>Diversos <strong>shots para curtir.</strong></> : category.label === 'Frozens' ? <><strong><AnimatedClubCount value={20} start={countReady} onComplete={handleCountComplete} /> Frozens</strong> para descobrir.</> : <>Mais de <strong><AnimatedClubCount value={category.number} start={countReady} onComplete={handleCountComplete} /> {category.id === 'syrups' ? 'receitas de Xaropes Artesanais' : category.label.toLocaleLowerCase('pt-BR')}.</strong></>}</h2>
      </div>
      <p className="club-category-subtitle" ref={subtitle}>{category.subtitle}</p>
      <div className="club-covers-window" ref={covers} aria-label="Capas das receitas; arraste para explorar"
        onPointerDown={event => { dragging.current = true; lastX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (dragging.current) { move(lastX.current - event.clientX); lastX.current = event.clientX; } }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
        {[0, 1, 2].map(layer => <div key={layer} className={`club-depth-layer club-depth-${layer}`} ref={el => { surfaces.current[layer] = el; }}>{cards(layer)}</div>)}
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
  offerDeadline: number;
  loading: boolean;
  onSubscribe: () => void;
  reveal: React.ReactNode;
};

function PublicOfferBanner({ savings, deadline }: { savings: number; deadline: number }) {
  const { mm, ss, isActive } = useIntroCountdown(deadline);
  if (!deadline) return <div className="club-discount-banner" role="status">Desconto de R$ {savings} ativo</div>;
  if (!isActive) return null;
  return <div className="club-discount-banner" role="status">Desconto de R$ {savings} ativo <span>· Expira em <strong className="tabular-nums">{mm}:{ss}</strong></span></div>;
}

export default function ClubePublicLanding(props: Props) {
  const [ctaVisible,setCtaVisible]=useState(false);
  const [hasScrolled,setHasScrolled]=useState(false);
  const hero=useRef<HTMLElement>(null);
  useEffect(()=>{
    const scroller=hero.current?.closest('.club-public');
    if(!scroller)return;
    const stop=()=>{if(scroller.scrollTop>0){setHasScrolled(true);scroller.removeEventListener('scroll',stop)}};
    scroller.addEventListener('scroll',stop,{passive:true});stop();
    return()=>scroller.removeEventListener('scroll',stop);
  },[]);
  const [footerReplacesCta,setFooterReplacesCta]=useState(false);
  const footer=useRef<HTMLElement>(null);
  const floatingCta=useRef<HTMLButtonElement>(null);
  const revealCta=React.useCallback(()=>setCtaVisible(true),[]);
  const pricing = useRef<HTMLElement>(null);
  const scrollToPricing = () => pricing.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  useEffect(()=>{
    const element=footer.current;
    const scroller=element?.closest('.club-public');
    const button=floatingCta.current;
    if(!element||!scroller||!button)return;
    let frame=0;
    const update=()=>{
      frame=0;
      const bounds=scroller.getBoundingClientRect();
      const footerTop=element.getBoundingClientRect().top;
      button.style.setProperty('--club-footer-overlap',`${Math.max(0,bounds.bottom-footerTop)}px`);
      setFooterReplacesCta(footerTop<bounds.top+button.offsetHeight+24);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
    scroller.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    const observer=new ResizeObserver(schedule);observer.observe(element);observer.observe(scroller);update();
    return()=>{scroller.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer.disconnect();cancelAnimationFrame(frame)};
  },[]);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Clube dos Drinkeros · Mais de mil receitas em vídeo';
    return () => { document.title = previous; };
  }, []);
  return <div className={`club-public${props.unlocked ? ' club-unlocked' : ''}`} ref={props.scrollRef}>
    {props.reveal}
    {props.unlocked && <PublicOfferBanner savings={props.savings} deadline={props.offerDeadline} />}
    <button ref={floatingCta} type="button" className={`club-floating-cta${ctaVisible&&!footerReplacesCta ? ' club-cta-visible' : ''}`} aria-hidden={!ctaVisible||footerReplacesCta} tabIndex={ctaVisible&&!footerReplacesCta?0:-1} disabled={!ctaVisible || footerReplacesCta || (props.unlocked && props.loading)} onClick={props.unlocked ? props.onSubscribe : scrollToPricing}><span className="club-cta-copy"><span>Quero entrar para o</span><strong>CLUBE</strong></span><ArrowRight aria-hidden="true" /></button>
    <header className="club-public-hero" ref={hero}>
      <p className="club-invite">Torne-se membro do</p>
      <h1><img className="club-logo" src="/club-landing/logo.png" alt="Clube dos Drinkeros" width="500" height="140" fetchPriority="high" /></h1>
      <p className="club-pocket">Mais de <strong><AnimatedClubCount value={1000} /></strong> receitas no seu bolso.</p>
      <div className="club-hero-strip" aria-hidden="true"><div><img src={drinksStrip} alt="" /><img src={drinksStrip} alt="" /></div></div>
      <p className="club-discover">Descubra o que espera por você</p>
      <ArrowDown className={`club-down${hasScrolled ? '' : ' club-down-bouncing'}`} aria-hidden="true" />
    </header>
    {catalog.map((category,index) => <CategoryScene key={category.id} category={category} direction={index % 2 === 0 ? 1 : -1} onCoversReached={index===0?revealCta:undefined} />)}
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
        <div className="club-payment-brands" aria-label="Meios de pagamento">
          {[[payVisa, 'Visa'], [payMaster, 'Mastercard'], [payApple, 'Apple Pay'], [payGoogle, 'Google Pay'], [payPix, 'Pix']].map(([src, alt]) => <span key={alt}><img src={src} alt={alt} width="42" height="20" /></span>)}
        </div>
        <p className="club-payment-note">Pagamento por cartão ou Pix. No cartão, assinatura com renovação automática; no Pix, acesso por 12 meses.</p>
      </div>
    </section>
    <section className="club-public-testimonials"><h2>Olhe o que o pessoal acha da gente.</h2><TestimonialsCarousel hideHeading /></section>
    <section className="club-faq"><h2>Ficou alguma dúvida?</h2>
      <details><summary>Preciso ter experiência?</summary><p>Você pode acompanhar o preparo em vídeo e escolher as receitas que combinam com os ingredientes que tem.</p></details>
      <details><summary>Posso usar no celular?</summary><p>Sim. Acesse o aplicativo pelo navegador do seu celular e salve suas receitas favoritas na sua conta.</p></details>
      <details><summary>Como recebo acesso?</summary><p>Crie sua conta, conclua o pagamento e aguarde a confirmação. O acesso será vinculado à sua conta.</p></details>
    </section>
    <footer className="club-public-footer" ref={footer}>
      <div className="club-footer-main"><div className="club-footer-brand"><img src={drinkerosLogo} alt="Drinkeros" width="180" height="55" /><p>Receitas para transformar cada momento.</p></div>
        <nav aria-label="Institucional"><h2>Drinkeros</h2><Link to="/login">Minha conta</Link><a href="https://wa.me/5548991601025" target="_blank" rel="noopener noreferrer">Atendimento</a></nav>
        <nav aria-label="Informações legais"><h2>Informações</h2>
          <a href="https://wa.me/5548991601025?text=Gostaria%20de%20consultar%20a%20pol%C3%ADtica%20de%20privacidade" target="_blank" rel="noopener noreferrer">Solicitar política de privacidade</a><a href="https://wa.me/5548991601025?text=Gostaria%20de%20consultar%20os%20termos%20de%20uso" target="_blank" rel="noopener noreferrer">Solicitar termos de uso</a>
        </nav>
      </div><p className="club-footer-copyright">© {new Date().getFullYear()} Drinkeros. Todos os direitos reservados.</p>
    </footer>
  </div>;
}
