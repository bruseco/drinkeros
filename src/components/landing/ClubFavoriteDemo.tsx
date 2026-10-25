import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewportMotion } from './useViewportMotion';
import { Check, FolderPlus, Heart, MousePointer2, Plus } from 'lucide-react';

const LIST_NAME = 'Jantar mexicano';
const COVER = 'https://pvjlcfhqueibjnkuzzna.supabase.co/storage/v1/object/public/package-covers/recipe-1775251374265-97.jpg';

/** Decorative animation only: never authenticates or mutates real favorites. */
export default function ClubFavoriteDemo() {
  const frame = useRef<HTMLElement>(null);
  const visible = useViewportMotion(frame);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [point,setPoint] = useState({left:0,top:0});
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => { media.removeEventListener('change', sync); };
  }, []);
  useEffect(() => {
    if (reducedMotion) { setElapsed(10000); return; }
    if (!visible) return;
    const start = performance.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((performance.now() - start) % 12000), 80);
    return () => window.clearInterval(timer);
  }, [visible, reducedMotion]);

  const modal = elapsed >= 2700 && elapsed < 8500;
  const input = elapsed >= 3800;
  const typed = LIST_NAME.slice(0, Math.max(0, Math.floor((elapsed - 4000) / 120)));
  const saved = elapsed >= 8500 && elapsed < 11600;
  const phase = saved ? 'saved' : modal ? input ? 'typing' : 'choose' : 'card';
  const cursor = elapsed < 1000 ? 'start' : elapsed < 2900 ? 'heart' : elapsed < 3900 ? 'new-list' : elapsed < 7200 ? 'input' : elapsed < 8500 ? 'save' : 'end';
  useLayoutEffect(()=>{
    const element=frame.current;
    if(!element)return;
    const update=()=>{
      const rect=element.getBoundingClientRect();
      const selectors:Record<string,string>={heart:'.club-demo-heart','new-list':'.club-demo-create',input:'.club-demo-input',save:'.club-demo-save'};
      const target=selectors[cursor]?element.querySelector(selectors[cursor])?.getBoundingClientRect():null;
      setPoint(target?{left:target.left-rect.left+target.width/2,top:target.top-rect.top+target.height/2}:{left:rect.width*(cursor==='start'?.12:.78),top:rect.height*.85});
    };
    update();const observer=new ResizeObserver(update);observer.observe(element);
    return()=>observer.disconnect();
  },[cursor,phase]);
  const click = (elapsed >= 2400 && elapsed < 2700) || (elapsed >= 3550 && elapsed < 3800) || (elapsed >= 8150 && elapsed < 8450);
  return <figure className="club-favorite-demo" ref={frame} data-motion-active={visible} data-phase={phase} aria-label="Demonstração: salvar Margarita Tropicante na lista Jantar mexicano">
    <div className="club-demo-scene" aria-hidden="true">
      <span className="club-demo-label">Demonstração</span>
      <div className="club-demo-card"><img src={COVER} alt="" loading="lazy" /><div className="club-demo-card-info"><span>Margarita Tropicante</span><span className={`club-demo-heart${saved ? ' is-saved' : ''}`}><Heart fill={saved ? 'currentColor' : 'none'} /></span></div></div>
      <div className={`club-demo-dialog-layer${modal ? ' is-open' : ''}`}>
        <div className="club-demo-dialog"><span className="club-demo-dialog-title">Escolha uma lista</span><p>Escolha uma lista ou crie uma nova para salvar este favorito.</p>
          {input ? <><div className="club-demo-input"><span>{typed || '\u00a0'}</span><i /></div><div className="club-demo-save">Salvar <Check size={15} /></div></> : <div className="club-demo-create"><Plus size={18} /> Criar nova lista</div>}
        </div>
      </div>
      <div className={`club-demo-saved${saved ? ' is-open' : ''}`}><FolderPlus size={18} /><span>Salvo em <strong>{LIST_NAME}</strong></span><Check size={18} /></div>
      {!reducedMotion && <span style={point} className={`club-demo-cursor cursor-${cursor}${click ? ' is-clicking' : ''}`}><MousePointer2 size={28} fill="white" stroke="#141414" strokeWidth={1.5} /></span>}
    </div>
    <figcaption className="sr-only">Exemplo ilustrativo de criação de uma lista de favoritos. Nenhuma lista real é criada.</figcaption>
  </figure>;
}
