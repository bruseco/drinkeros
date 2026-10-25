import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Loader2, MousePointer2, ShoppingCart, Users, Wine } from 'lucide-react';
import { makeShoppingPlan, shoppingQuantity } from '@/lib/shoppingPlan';

// A public, illustrative snapshot. Uses the same calculator as the app, with no database writes.
const plan = makeShoppingPlan('Festa com caipirinha', [{
  id: 'demo-caipirinha', name: 'Caipirinha', yield: 1,
  ingredients: ['Açúcar', 'Cachaça', 'Limão Taiti'],
  instructions: 'Em um copo ilha bela\nAdicionar limão picado\ncolheres de chá de açúcar\nMacere\n1 dose de cachaça Velho Barreiro\nGelo picado\nMisture bem\nDecore com rodela de limão na borda e canudo de papel',
}], 5, 3);
const order = ['Cachaça', 'Açúcar', 'Limão Taiti', 'Gelo'];
const items = [...plan.items].sort((a,b) => order.indexOf(a.name)-order.indexOf(b.name));

export default function ClubShoppingDemo() {
  const frame = useRef<HTMLElement>(null);
  const [visible,setVisible] = useState(false);
  const [reduced,setReduced] = useState(false);
  const [elapsed,setElapsed] = useState(0);
  const [point,setPoint] = useState({left:0,top:0});
  useEffect(()=>{
    const element=frame.current;if(!element)return;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(media.matches);sync();media.addEventListener('change',sync);
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{root:element.closest('.club-public'),threshold:.15});
    observer.observe(element);return()=>{observer.disconnect();media.removeEventListener('change',sync)};
  },[]);
  useEffect(()=>{
    if(reduced){setElapsed(18000);return}if(!visible)return;
    const start=performance.now();setElapsed(0);
    const timer=window.setInterval(()=>setElapsed((performance.now()-start)%20000),80);
    return()=>window.clearInterval(timer);
  },[visible,reduced]);
  const phase=elapsed<2700?'list':elapsed<5400?'people':elapsed<8100?'drinks':elapsed<9400?'loading':'result';
  const checked=phase==='result'?Math.max(0,Math.min(4,Math.floor((elapsed-11000)/1500)+1)):0;
  const cursor=phase==='result'?'check':(phase==='people'&&elapsed<4400)||(phase==='drinks'&&elapsed<7100)?'input':'action';
  useLayoutEffect(()=>{
    const element=frame.current;if(!element)return;
    const update=()=>{
      const selector=cursor==='check'?'.club-shopping-item:not(.is-bought) .club-shopping-checkbox':cursor==='input'?'.club-shopping-number':'.club-shopping-action';
      const target=element.querySelector(selector)?.getBoundingClientRect();const bounds=element.getBoundingClientRect();
      if(target)setPoint({left:target.left-bounds.left+target.width/2,top:target.top-bounds.top+target.height/2});
    };
    update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
  },[phase,cursor,checked]);
  return <figure className="club-shopping-demo" ref={frame} data-phase={phase} aria-label="Demonstração: lista de compras de caipirinha para 5 pessoas, 3 drinks por pessoa">
    <div className="club-shopping-scene" aria-hidden="true"><span className="club-demo-label">Demonstração</span>
      {phase==='list'&&<div className="club-shopping-start"><span className="club-demo-dialog-title">Festa com caipirinha</span><div className="club-shopping-recipe"><Wine size={28}/><div><strong>Caipirinha</strong><span>Receita selecionada</span></div></div><div className="club-shopping-action"><ShoppingCart size={16}/> Gerar lista de compras</div></div>}
      {(phase==='people'||phase==='drinks')&&<div className="club-shopping-question"><span className="club-shopping-step">Etapa {phase==='people'?'1':'2'} de 2</span><span className="club-demo-dialog-title">{phase==='people'?'Quantas pessoas vão participar?':'Quantos drinks por pessoa?'}</span><div className="club-shopping-number">{phase==='people'?(elapsed>3600?'5':''):(elapsed>6300?'3':'')}</div><div className="club-shopping-action">{phase==='people'?'Continuar':'Gerar lista de compras'}</div></div>}
      {phase==='loading'&&<div className="club-shopping-loading"><Loader2 className="animate-spin"/><strong>Gerando sua lista de compras…</strong></div>}
      {phase==='result'&&<div className="club-shopping-result"><span className="club-demo-dialog-title">Sua lista de compras</span><span className="club-shopping-recipe-name">Caipirinha</span><div className="club-shopping-summary"><span><Users size={14}/>5 pessoas</span><span><Wine size={14}/>3 drinks por pessoa</span><strong>15 drinks no total</strong></div><div className="club-shopping-progress"><span style={{width:`${checked/4*100}%`}}/></div><div className="club-shopping-items">{items.map((item,index)=>({item,index,bought:index<checked})).sort((a,b)=>Number(a.bought)-Number(b.bought)||a.index-b.index).map(({item,bought})=><div key={item.name} className={`club-shopping-item${bought?' is-bought':''}`}><span className="club-shopping-checkbox">{bought&&<Check size={12}/>}</span><div><strong>{item.name}</strong><span>{shoppingQuantity(item)}</span></div></div>)}</div><p className="club-shopping-estimate">Exemplo com estimativas de açúcar, limão e gelo. Confira e ajuste antes de comprar.</p></div>}
      {!reduced&&phase!=='loading'&&<span style={point} className={`club-shopping-cursor shopping-cursor-${cursor}`}><MousePointer2 size={26} fill="white" stroke="#141414" strokeWidth={1.5}/></span>}
    </div><figcaption className="sr-only">Exemplo ilustrativo. As quantidades usam o calculador do aplicativo. Nenhuma lista ou compra real é criada.</figcaption>
  </figure>;
}
