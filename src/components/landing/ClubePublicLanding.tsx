import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, X } from 'lucide-react';
import drinksStrip from '@/assets/1000-drinks.jpg';
import drinkerosLogo from '@/assets/logotipo-drinkeros.png';
import { Link } from 'react-router-dom';
import payVisa from '@/assets/pagamento-visa.png';
import payMaster from '@/assets/pagamento-mastercard.png';
import payApple from '@/assets/pagamento-apple.png';
import payGoogle from '@/assets/pagamento-google.png';
import payPix from '@/assets/pagamento-pix.png';
import TestimonialsCarousel from './TestimonialsCarousel';
import ClubRecipeLoop from './ClubRecipeLoop';
import ClubFavoriteDemo from './ClubFavoriteDemo';
import ClubShoppingDemo from './ClubShoppingDemo';
import ClubCommunityDemo from './ClubCommunityDemo';
import catalog from './clubLandingCatalog.json';
import dessertRecipes from './clubDessertCovers.json';
const landingCategories = [...catalog, dessertRecipes];
import './clubePublicLanding.css';
import { useViewportMotion } from './useViewportMotion';
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
    }, { root: element.closest('.club-public'), rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    observer.observe(element.closest('.club-category-heading') ?? element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value, start, onComplete]);
  return <span className={`club-count ${className}`} data-started={display > 0} aria-label={value.toLocaleString('pt-BR')} ref={ref}><span aria-hidden="true">{display.toLocaleString('pt-BR')}</span></span>;
}

type Category = typeof catalog[number];
const DEPTHS = [
  [122, 1, 1, -3], [12, .72, .42, 4], [162, 1, 1, 2], [46, .83, .62, -4], [113, 1, 1, 3],
  [8, .7, .4, -3], [155, .98, 1, -2], [53, .84, .65, 3], [120, 1, 1, -4], [15, .73, .46, 4],
];
const SPEEDS = [52, 31.2, 13];

function CategoryScene({ category, direction, onCoversReached }: { category: Category; direction: 1 | -1; onCoversReached?: () => void }) {
  const loopWidth=category.recipes.length*190;
  const [sceneWidth,setSceneWidth]=useState(()=>window.innerWidth);
  const repeatCount=Math.max(2,Math.ceil(sceneWidth/loopWidth)+1);
  const scene = useRef<HTMLElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const subtitle = useRef<HTMLParagraphElement>(null);
  const covers = useRef<HTMLDivElement>(null);
  const motionActive = useViewportMotion(covers);
  const [countReady, setCountReady] = useState(false);
  const [highlighted,setHighlighted]=useState(false);
  const handleCountComplete=React.useCallback(()=>{setHighlighted(true)},[]);
  useEffect(()=>{if(!countReady)setHighlighted(false);else if(category.number===null||category.id==='latest-recipes')setHighlighted(true)},[countReady,category.number,category.id]);
  const surfaces = useRef<Array<HTMLDivElement | null>>([]);
  const offsets = useRef([0, 0, 0]);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastDragTime = useRef(0);
  const glideVelocity = useRef(0);
  const travelDirection = useRef<number>(direction);
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
      setSceneWidth(width);
      const position = (element: HTMLElement | null) => {
        if (!element) return 0;
        const top = element.getBoundingClientRect().top - viewport.top;
        const entryStart = Math.min(viewport.height, top + scroller.scrollTop);
        const entryEnd = Math.min(viewport.height * .55, entryStart - viewport.height * .35);
        const progress = media.matches ? 0 : Math.max(0, Math.min(1, (top - entryEnd) / (entryStart - entryEnd)));
        // A full viewport plus a small gutter keeps the entire surface offscreen.
        const eased = progress * progress * (3 - 2 * progress);
        element.style.transform = `translate3d(${direction * eased * (width + 32)}px,0,0)`;
        element.style.opacity = String(1 - progress);
        return progress;
      };
      const progress = position(heading.current);
      position(subtitle.current);
      position(covers.current);
      const next = progress < .75 && !!scene.current && scene.current.getBoundingClientRect().bottom > viewport.top;
      if (next !== ready) { ready = next; setCountReady(next); }
      const headingBounds = heading.current?.getBoundingClientRect();
      const coversBounds = covers.current?.getBoundingClientRect();
      if (!ctaRevealed && headingBounds && coversBounds && headingBounds.bottom <= viewport.top && coversBounds.top + coversBounds.height * .75 <= viewport.top + viewport.height * .15) {
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
      offsets.current[index] = ((offsets.current[index] + distance * SPEEDS[index] / SPEEDS[0]) % loopWidth + loopWidth) % loopWidth;
      if (layer) layer.style.transform = `translate3d(${-offsets.current[index]}px,0,0)`;
    });
  };
  useEffect(() => {
    if(!motionActive)return;
    let previous=0,frame=0;
    const tick=(time:number)=>{
      const dt=previous?Math.min(time-previous,60)/1000:0;
      previous=time;
      if(!dragging.current){
        const cruise=SPEEDS[0]*travelDirection.current;
        const decay=Math.exp(-dt/.9);
        move(cruise*dt+(glideVelocity.current-cruise)*.9*(1-decay));
        glideVelocity.current=cruise+(glideVelocity.current-cruise)*decay;
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{
      cancelAnimationFrame(frame);
      glideVelocity.current=0;
      dragging.current=false;
      surfaces.current.forEach((layer,index)=>{if(layer)layer.style.transform=`translateX(${-offsets.current[index]}px)`});
    };
  },[motionActive,direction,loopWidth]);
  const cards = (layer: number) => Array.from({length:repeatCount},(_,cycle)=>cycle).flatMap(cycle => category.recipes.flatMap((recipe, index) => {
    const [y, scale, opacity, rotation] = category.id==='category-4'&&recipe.title==='Sangue de Cobra'
      ? [28,.72,.42,3]
      : DEPTHS[index % DEPTHS.length];
    if (layer < 2 && (scale >= .95 ? 0 : 1) !== layer) return [];
    return (layer === 2 ? [0, 1] : [0]).map(ghost => (
      <figure key={`${cycle}-${index}-${ghost}`} style={{
        left: index * 190 + cycle * loopWidth + (layer === 2 ? ghost * 98 : 0),
        top: layer === 2 ? (ghost ? 175 + index % 3 * 20 : index % 3 * 34 - 15) : y,
        opacity: layer === 2 ? (ghost ? .10 : .16) : opacity,
        transform: `scale(${layer === 2 ? [.39, .47, .35][index % 3] : scale}) rotate(${rotation}deg)`,
      }} aria-hidden={cycle > 0 || layer === 2 ? true : undefined}>
        <img src={recipe.image} alt={cycle > 0 || layer === 2 ? '' : recipe.title} width="1280" height="720" loading="lazy" decoding="async" draggable={false} />
      </figure>
    ));
  }));
  return <section className={`club-scene club-${category.id}${highlighted ? ' club-highlight-complete' : ''}`} ref={scene} data-motion-active={motionActive} aria-label={category.label}>
    <div className="club-stage">
      <div className="club-category-copy club-category-heading" ref={heading}>
        <h2>{category.id === 'desserts' ? <>Diversas <strong>sobremesas</strong> para fazer em datas comemorativas.</> : category.number === null ? <>Diversos <strong>shots para curtir.</strong></> : category.id === 'latest-recipes' ? <>São as receitas <strong>mais criativas da internet</strong> no seu celular.</> : category.label === 'Frozens' ? <>Mais de <strong><AnimatedClubCount value={category.number} start={countReady} onComplete={handleCountComplete} /> Frozens</strong> para descobrir.</> : <>Mais de <strong><AnimatedClubCount value={category.number} start={countReady} onComplete={handleCountComplete} /> {category.id === 'syrups' ? 'receitas de Xaropes Artesanais' : category.label.toLocaleLowerCase('pt-BR')}.</strong></>}</h2>
      </div>
      {category.subtitle&&<p className="club-category-subtitle" ref={subtitle}>{category.subtitle}</p>}
      <div className="club-covers-window" ref={covers} aria-label="Capas das receitas; arraste para explorar"
        onPointerDown={event => { if(event.pointerType==='mouse'&&event.button!==0)return; dragging.current = true; lastX.current = event.clientX; lastDragTime.current=event.timeStamp; glideVelocity.current=0; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (dragging.current) { const distance=lastX.current-event.clientX; const elapsed=event.timeStamp-lastDragTime.current; move(distance); if(Math.abs(distance)>.5)travelDirection.current=Math.sign(distance); if(elapsed>0){const speed=Math.max(-2400,Math.min(2400,distance/elapsed*1000));glideVelocity.current=elapsed>100?speed:glideVelocity.current*.35+speed*.65;} lastX.current = event.clientX; lastDragTime.current=event.timeStamp; } }}
        onPointerUp={event => { if(event.timeStamp-lastDragTime.current>100||glideVelocity.current*travelDirection.current<0)glideVelocity.current=0; dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; glideVelocity.current=0; }}
        onLostPointerCapture={() => { dragging.current = false; }}>
        {[0, 1, 2].map(layer => <div key={layer} className={`club-depth-layer club-depth-${layer}`} ref={el => { surfaces.current[layer] = el; }}>{cards(layer)}</div>)}
      </div>
    </div>
  </section>;
}

type Props = {
  staticVariant?: boolean;
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

function ClubButtonIcons() {
  return <span className="club-cta-icons" aria-hidden="true"><ArrowRight /><svg className="club-door-filled" viewBox="0 0 24 32" fill="currentColor"><path fillRule="evenodd" d="M2 3h13v2H4v24h4v2H0v-2h2V3Zm6-2 14 4v26l-14-4V1Zm4 13a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /></svg></span>;
}

function PublicOfferBanner({ savings, deadline }: { savings: number; deadline: number }) {
  const { mm, ss, isActive } = useIntroCountdown(deadline);
  if (deadline && !isActive) return null;
  return <div className="club-discount-banner" role="status">
    <span className="club-banner-discount">Desconto de <strong className="club-banner-money">R$ {savings}</strong> ativo</span>
    {!!deadline && <span className="club-banner-separator" aria-hidden="true"/>}
    {!!deadline && <span className="club-banner-expiry" aria-live="off">Expira em <strong className="club-banner-timer tabular-nums">{mm}:{ss}</strong></span>}
  </div>;
}

export default function ClubePublicLanding(props: Props) {
  const brick=useRef<HTMLDivElement>(null);
  const brickActive=useViewportMotion(brick);
  const [ctaVisible,setCtaVisible]=useState(false);
  const [hasScrolled,setHasScrolled]=useState(false);
  const hero=useRef<HTMLElement>(null);
  const pocket=useRef<HTMLParagraphElement>(null);
  const pocketMotion=useViewportMotion(pocket);
  const creativity=useRef<HTMLElement>(null);
  const creativityMotion=useViewportMotion(creativity);
  const benefits=useRef<HTMLUListElement>(null);
  const benefitsMotion=useViewportMotion(benefits);
  useLayoutEffect(()=>{
    const scroller=hero.current?.closest<HTMLElement>('.club-public');
    if(!scroller||!hero.current||!pocket.current)return;
    const update=()=>{
      if(!pocket.current)return;
      const end=pocket.current.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
      scroller.style.setProperty('--club-brick-height',`${Math.round(end)}px`);
    };
    const observer=new ResizeObserver(update);
    observer.observe(hero.current);
    observer.observe(pocket.current);
    update();
    return()=>observer.disconnect();
  },[]);
  const heroStrip=useRef<HTMLDivElement>(null);
  const heroMotion=useViewportMotion(heroStrip);
  useEffect(()=>{
    const scroller=hero.current?.closest('.club-public');
    if(!scroller)return;
    const stop=()=>{if(scroller.scrollTop>0){setHasScrolled(true);scroller.removeEventListener('scroll',stop)}};
    scroller.addEventListener('scroll',stop,{passive:true});stop();
    return()=>scroller.removeEventListener('scroll',stop);
  },[]);
  const [footerReplacesCta,setFooterReplacesCta]=useState(false);
  const [purchaseVisible,setPurchaseVisible]=useState(false);
  const purchase=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const button=purchase.current;
    const root=button?.closest('.club-public');
    if(!button||!root)return;
    let observer:IntersectionObserver|undefined;
    let previousInset=-1;
    const connect=()=>{
      const inset=props.unlocked?Math.ceil(root.querySelector('.club-discount-banner')?.getBoundingClientRect().height??0):0;
      if(observer&&inset===previousInset)return;
      previousInset=inset;observer?.disconnect();
      observer=new IntersectionObserver(([entry])=>setPurchaseVisible(entry.isIntersecting),{root,rootMargin:`-${inset}px 0px 0px 0px`,threshold:0});
      observer.observe(button);
    };
    connect();const resize=new ResizeObserver(connect);resize.observe(root);
    const banner=root.querySelector('.club-discount-banner');if(banner)resize.observe(banner);
    return()=>{observer?.disconnect();resize.disconnect()};
  },[props.unlocked]);
  const footer=useRef<HTMLElement>(null);
  const floatingCta=useRef<HTMLButtonElement>(null);
  const revealCta=React.useCallback(()=>setCtaVisible(true),[]);
  const pricing = useRef<HTMLElement>(null);
  const showFloatingCta=ctaVisible&&!footerReplacesCta&&!purchaseVisible;
  const scrollToPricing = () => pricing.current?.scrollIntoView({ behavior: props.staticVariant || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
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
      const brand=element.querySelector('.club-footer-brand')?.getBoundingClientRect();
      const besideLogo=window.matchMedia('(max-width:600px)').matches && brand;
      const stopBottom=besideLogo ? brand.top+brand.height/2+button.offsetHeight/2 : footerTop-18;
      button.style.setProperty('--club-footer-overlap',`${Math.max(0,bounds.bottom-stopBottom-18)}px`);
      setFooterReplacesCta(stopBottom<bounds.top+button.offsetHeight+24);
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
  return <div className={`club-public${props.staticVariant ? ' club-static' : ''}${props.unlocked ? ' club-unlocked' : ''}`} ref={props.scrollRef}>
    <div className="club-brick-image" ref={brick} data-motion-active={brickActive} aria-hidden="true"/>
    {props.reveal}
    {props.unlocked && <PublicOfferBanner savings={props.savings} deadline={props.offerDeadline} />}
    <button ref={floatingCta} type="button" className={`club-floating-cta${showFloatingCta ? ' club-cta-visible' : ''}`} aria-hidden={!showFloatingCta} tabIndex={showFloatingCta?0:-1} disabled={!showFloatingCta || (props.unlocked && props.loading)} onClick={props.unlocked ? props.onSubscribe : scrollToPricing}><span className="club-cta-copy"><span>Quero entrar p/ o</span><strong>CLUBE</strong></span><ClubButtonIcons /></button>
    <header className="club-public-hero" ref={hero}>
      <p className="club-invite">Torne-se membro do</p>
      <h1><img className="club-logo" src="/club-landing/logo.png" alt="Clube dos Drinkeros" width="500" height="140" fetchPriority="high" /></h1>
      <p className="club-pocket" ref={pocket} data-motion-active={pocketMotion}>Mais de <strong>{props.staticVariant ? '1.000' : <AnimatedClubCount value={1000} />}</strong> receitas no seu bolso.</p>
      <div ref={heroStrip} data-motion-active={heroMotion} className="club-hero-strip" aria-hidden="true"><div><img src={drinksStrip} alt="" /><img src={drinksStrip} alt="" /></div></div>
      <p className="club-discover">Descubra o que esse aplicativo<br/>tem a lhe oferecer</p>
      <div className="club-down-slot" aria-hidden="true"><ArrowDown className={`club-down${hasScrolled ? '' : ' club-down-bouncing'}`} aria-hidden="true" /></div>
    </header>
    {landingCategories.map((category,index) => props.staticVariant ? <section key={category.id} className={`club-static-category club-${category.id}`} aria-label={category.label}>
      <h2>{category.id === 'desserts' ? <>Diversas <strong>sobremesas</strong> para fazer em datas comemorativas.</> : category.number === null ? <>Diversos <strong>shots para curtir.</strong></> : <>Mais de <strong>{category.number.toLocaleString('pt-BR')} {category.label.toLocaleLowerCase('pt-BR')}.</strong></>}</h2>
      <div className="club-static-recipes">{category.recipes.map((recipe,index)=><figure key={`${recipe.title}-${index}`}><img src={recipe.image} alt={recipe.title} loading="lazy"/><figcaption>{recipe.title}</figcaption></figure>)}</div>
      <button type="button" className="club-static-block-cta" onClick={scrollToPricing}>Quero entrar para o Clube ↓</button>
    </section> : <CategoryScene key={category.id} category={category} direction={index % 2 === 0 ? 1 : -1} onCoversReached={category.id === 'category-1' ? revealCta : undefined} />)}
    <section className="club-creativity" ref={creativity} data-motion-active={creativityMotion}><h2>São as receitas <strong>mais criativas da internet</strong> no seu celular.</h2><p>Para acessar quando quiser.</p></section>
    {props.staticVariant && <section className="club-tools" aria-label="Organize seus drinks">{[
      ['Receitas em vídeo.','Assista como preparar. Todas as receitas foram realizadas e testadas.'],
      ['Salve suas receitas.','Monte listas de favoritos para cada ocasião.'],
      ['Organize a festa.','Monte sua lista e gere o checklist de compras para a sua festa.'],
      ['Comunidade.','Compartilhe e descubra receitas com outros usuários.'],
    ].map(([title,text])=><article key={title} className="club-feature"><h2>{title}</h2><p>{text}</p><button className="club-static-block-cta" type="button" onClick={scrollToPricing}>Quero entrar para o Clube ↓</button></article>)}</section>}
    {!props.staticVariant && <section className="club-tools" aria-label="Organize seus drinks">
      <article className="club-feature"><p className="club-eyebrow club-video-eyebrow"><span>Receitas em vídeo</span><svg role="img" aria-label="YouTube" viewBox="0 0 28 20"><rect width="28" height="20" rx="5" fill="#fff"/><path d="m11 5 8 5-8 5Z" fill="#111"/></svg></p><h2>Assista como preparar.</h2><p>Todas as receitas foram realizadas e testadas.</p><ClubRecipeLoop /></article>
      <article className="club-feature"><h2>Salve suas receitas.</h2><p>Monte listas de favoritos para cada ocasião.</p><ClubFavoriteDemo /></article>
      <article className="club-feature club-shopping-feature"><h2>Organize a festa.</h2><p>Monte sua lista e gere o checklist de compras para a sua festa.</p><ClubShoppingDemo /></article>
      <article className="club-feature club-community-feature"><h2>Comunidade.</h2><p>Compartilhe e descubra receitas com outros usuários.</p><ClubCommunityDemo /></article>
    </section>
    }
    <section id="clube-pricing" className="club-public-pricing" ref={pricing}>
      <h2>Entre para o Clube!</h2>
      <div className="club-offer">
        <ul className="club-benefits" ref={benefits} data-motion-active={benefitsMotion}>{[{text:'Acesso a mais de 1.000 receitas em vídeo',value:47},{text:'Mais de 40 receitas de xaropes artesanais',value:53},{text:'Organizador de festas: crie listas de favoritos e gere listas de compras',value:97}].map(benefit => <li key={benefit.text}><Check aria-hidden="true" /><span>{benefit.text.startsWith('Organizador de festas:')?<><b className="club-benefit-highlight">Organizador de festas</b>{benefit.text.slice('Organizador de festas'.length)}</>:benefit.text}</span><strong>R$ {benefit.value}</strong></li>)}</ul>
        {props.unlocked && <p className="club-comparison"><X aria-hidden="true" /><span>Quanto você pagaria</span><del>R$ {props.fullPrice}</del></p>}
        {!props.unlocked && <p className="club-total-label">Total</p>}
        <div className="club-price" ref={props.registerPriceCard}><span>R$</span> {props.price}</div>
        <p className="club-access-label">* Você tem um ano de acesso para usar todos esses benefícios.</p>
        <button ref={purchase} type="button" data-motion-active={purchaseVisible} className="club-purchase" disabled={props.loading} onClick={props.onSubscribe}><span className="club-purchase-copy">{props.loading ? 'Abrindo checkout…' : 'Quero entrar p/ o Clube'}</span><ClubButtonIcons /></button>
        <div className="club-payment-brands" aria-label="Meios de pagamento">
          {[[payVisa, 'Visa'], [payMaster, 'Mastercard'], [payApple, 'Apple Pay'], [payGoogle, 'Google Pay'], [payPix, 'Pix']].map(([src, alt]) => <span key={alt}><img src={src} alt={alt} width="42" height="20" /></span>)}
        </div>
        <p className="club-payment-note">Pagamento por cartão ou Pix. No cartão, renovação automática pelo valor contratado enquanto a assinatura permanecer ativa. No Pix, acesso por 12 meses. Após cancelamento, uma nova contratação segue a oferta vigente.</p>
      </div>
    </section>
    <section className="club-public-testimonials"><h2>Olhe o que o pessoal acha da gente. <span aria-hidden="true">👀</span></h2><TestimonialsCarousel hideHeading staticLayout={props.staticVariant} /></section>
    <section className="club-faq"><h2>Ficou alguma dúvida?</h2>
      <details><summary>Preciso ter experiência?</summary><p>Você pode acompanhar o preparo em vídeo e escolher as receitas que combinam com os ingredientes que tem.</p></details>
      <details><summary>Posso usar no celular?</summary><p>Sim. Acesse o aplicativo pelo navegador do seu celular e salve suas receitas favoritas na sua conta.</p></details>
      <details><summary>Como recebo acesso?</summary><p>Conclua o pagamento e aguarde a confirmação. Depois, defina sua senha para entrar. Se já tiver conta, use seu login atual.</p></details>
    </section>
    <footer className="club-public-footer" ref={footer}>
      <div className="club-footer-main"><div className="club-footer-brand"><img src={drinkerosLogo} alt="Drinkeros" width="180" height="55" /></div>
        <nav aria-label="Institucional"><h2>Drinkeros</h2><Link to="/login">Minha conta</Link><a href="https://wa.me/5548991601025" target="_blank" rel="noopener noreferrer">Atendimento</a></nav>
        <nav aria-label="Informações legais"><h2>Informações</h2>
          <Link to="/politica-de-privacidade">Política de privacidade</Link><Link to="/termos-de-uso">Termos de uso</Link>
        </nav>
      </div><p className="club-footer-copyright">© {new Date().getFullYear()} Drinkeros. Todos os direitos reservados.</p>
    </footer>
  </div>;
}
