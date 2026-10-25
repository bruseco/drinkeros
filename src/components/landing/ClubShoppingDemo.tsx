import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewportMotion } from './useViewportMotion';
import { Check, Loader2, MousePointer2, ShoppingCart, Users, Wine } from 'lucide-react';
import { makeShoppingPlan, shoppingQuantity } from '@/lib/shoppingPlan';

import demoRecipes from './clubShoppingDemoRecipes.json';

// Public illustrative snapshots; the production calculator runs locally, without writes.
const plan = makeShoppingPlan('Jantar mexicano', demoRecipes, 5, 3);
const items = plan.items.filter(item => !item.optional);

export default function ClubShoppingDemo() {
  const frame = useRef<HTMLElement>(null);
  const visible = useViewportMotion(frame);
  const [reduced,setReduced] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const [running,setRunning]=useState(false);
  const [point,setPoint] = useState({left:0,top:0});
  useEffect(()=>{
    const element=frame.current;if(!element)return;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(media.matches);sync();media.addEventListener('change',sync);
    return()=>{media.removeEventListener('change',sync)};
  },[]);
  useEffect(()=>{
    setRunning(false);
    if(reduced){setElapsed(26000);return}
    setElapsed(0);if(!visible)return;
    let timer:number|undefined;
    const delay=window.setTimeout(()=>{
      setRunning(true);const start=performance.now();
      timer=window.setInterval(()=>setElapsed((performance.now()-start)%30000),80);
    },1000);
    return()=>{window.clearTimeout(delay);window.clearInterval(timer)};
  },[visible,reduced]);
  const phase=elapsed<1800?'choose':elapsed<4800?'list':elapsed<7500?'people':elapsed<10200?'drinks':elapsed<11500?'loading':'result';
  const checked=phase==='result'?Math.max(0,Math.min(items.length,Math.floor((elapsed-13000)/900)+1)):0;
  const cursor=phase==='result'?'check':(phase==='people'&&elapsed<6500)||(phase==='drinks'&&elapsed<9200)?'input':'action';
  useLayoutEffect(()=>{
    const element=frame.current;if(!element)return;
    const update=()=>{
      const selector=phase==='choose'?'.club-shopping-folder':cursor==='check'?'.club-shopping-item:not(.is-bought) .club-shopping-checkbox':cursor==='input'?'.club-shopping-number':'.club-shopping-action';
      const target=element.querySelector(selector)?.getBoundingClientRect();const bounds=element.getBoundingClientRect();
      if(target)setPoint({left:target.left-bounds.left+target.width/2,top:target.top-bounds.top+target.height/2});
    };
    update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
  },[phase,cursor,checked]);
  return <figure className="club-shopping-demo" ref={frame} data-motion-active={running} data-phase={phase} aria-label="Demonstração: lista Jantar mexicano com Margarita Tropicante e Paloma para 5 pessoas, 3 drinks por pessoa">
    <div className="club-shopping-scene" aria-hidden="true"><span className="club-demo-label">Demonstração</span>
      {phase==='choose'&&<div className="club-shopping-start"><span className="club-demo-dialog-title">Suas listas de favoritos</span><div className="club-shopping-folder"><strong>Jantar mexicano</strong><span>2 receitas salvas</span></div></div>}
      {phase==='list'&&<div className="club-shopping-start"><span className="club-demo-dialog-title">Jantar mexicano</span><div className="club-shopping-recipes">{demoRecipes.map(recipe=><div key={recipe.id}><img src={recipe.image} alt="" loading="lazy"/><strong>{recipe.name}</strong></div>)}</div><div className="club-shopping-action"><ShoppingCart size={16}/> Gerar lista de compras</div></div>}
      {(phase==='people'||phase==='drinks')&&<div className="club-shopping-question"><span className="club-shopping-step">Etapa {phase==='people'?'1':'2'} de 2</span><span className="club-demo-dialog-title">{phase==='people'?<Users size={20}/>:<Wine size={20}/>} {phase==='people'?'Quantas pessoas vão participar?':'Quantos drinks por pessoa?'}</span><div className="club-shopping-number">{phase==='people'?(elapsed>5700?'5':''):(elapsed>8400?'3':'')}</div><div className="club-shopping-action">{phase==='people'?'Continuar':'Gerar lista de compras'}</div></div>}
      {phase==='loading'&&<div className="club-shopping-loading"><Loader2 className="animate-spin"/><strong>Gerando sua lista de compras…</strong></div>}
      {phase==='result'&&<div className="club-shopping-result"><span className="club-demo-dialog-title">Sua lista de compras</span><span className="club-shopping-recipe-name">Jantar mexicano · Margarita Tropicante + Paloma</span><div className="club-shopping-summary"><span><Users size={14}/>5 pessoas</span><span><Wine size={14}/>3 drinks por pessoa</span><strong>15 drinks no total</strong></div><div className="club-shopping-progress"><span style={{width:`${checked/items.length*100}%`}}/></div><div className="club-shopping-items">{items.map((item,index)=>({item,index,bought:index<checked})).sort((a,b)=>Number(a.bought)-Number(b.bought)||a.index-b.index).map(({item,bought})=><div key={item.name} className={`club-shopping-item${bought?' is-bought':''}`}><span className="club-shopping-checkbox">{bought&&<Check size={12}/>}</span><div><strong>{item.name}</strong><span>{shoppingQuantity(item)}</span></div></div>)}</div><p className="club-shopping-estimate">Exemplo para 15 drinks, divididos entre as duas receitas. Inclui estimativas; decorações são opcionais.</p></div>}
      {!reduced&&phase!=='loading'&&<span style={point} className={`club-shopping-cursor shopping-cursor-${cursor}`}><MousePointer2 size={26} fill="white" stroke="#141414" strokeWidth={1.5}/></span>}
    </div><figcaption className="sr-only">Exemplo ilustrativo. As quantidades usam o calculador do aplicativo. Nenhuma lista ou compra real é criada.</figcaption>
  </figure>;
}
