import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Check,Heart,ImagePlus,MessageCircle,MousePointer2,Send,UserRound} from 'lucide-react';
import {useViewportMotion} from './useViewportMotion';
import COVER from '@/assets/community-demo/homemade-lime.webp';
import womanAvatar from '@/assets/community-demo/fictional-woman.webp';
import manAvatar from '@/assets/community-demo/fictional-man.webp';
const TITLE='Minha caipirinha de limão';
/** An illustrative local loop, never an actual post, like, testimonial or upload. */
export default function ClubCommunityDemo(){
 const frame=useRef<HTMLElement>(null);const visible=useViewportMotion(frame);
 const [elapsed,setElapsed]=useState(0),[running,setRunning]=useState(false),[reduced,setReduced]=useState(false);
 const [point,setPoint]=useState({left:0,top:0});
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>setReduced(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);
 useEffect(()=>{
  setRunning(false);if(reduced){setElapsed(12000);return}setElapsed(0);if(!visible)return;
  let timer:number|undefined;const delay=window.setTimeout(()=>{setRunning(true);const start=performance.now();timer=window.setInterval(()=>setElapsed((performance.now()-start)%15000),80)},1000);
  return()=>{clearTimeout(delay);clearInterval(timer)};
 },[visible,reduced]);
 const published=elapsed>=5200,uploading=elapsed>=1400&&elapsed<3600,hasImage=elapsed>=1400;
 const phase=published?'published':uploading?'uploading':hasImage?'ready':'choose';
 const likes=published?Math.min(3,Math.max(0,Math.floor((elapsed-6200)/900)+1)):0;
 const comments=elapsed>=8700?2:elapsed>=7200?1:0;
 useLayoutEffect(()=>{
  const element=frame.current;if(!element)return;
  const update=()=>{const selector=published?'.club-community-heart':hasImage?'.club-community-publish':'.club-community-upload';const target=element.querySelector(selector)?.getBoundingClientRect(),bounds=element.getBoundingClientRect();if(target)setPoint({left:target.left-bounds.left+target.width/2,top:target.top-bounds.top+target.height/2})};
  update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
 },[published,hasImage]);
 return <figure ref={frame} className="club-community-demo" data-motion-active={running} data-phase={phase} aria-label="Demonstração fictícia: publicar uma receita e receber curtidas e comentários">
  <div className="club-community-scene" aria-hidden="true"><span className="club-demo-label">Demonstração · perfis fictícios</span>
   {!published?<div className="club-community-compose"><strong>Compartilhar receita</strong>
    <div className={`club-community-upload${hasImage?' has-photo':''}`}>{hasImage?<img src={COVER} alt="" loading="lazy"/>:<><ImagePlus size={30}/><span>Adicionar foto da receita</span></>}</div>
    {uploading?<div className="club-community-upload-state"><span>Enviando foto…</span><div><i style={{width:`${Math.min(100,(elapsed-1400)/2200*100)}%`}}/></div></div>:hasImage?<p className="club-community-upload-state"><Check size={14}/> Foto adicionada</p>:null}
    {elapsed>=3600&&<div className="club-community-name">{TITLE.slice(0,Math.floor((elapsed-3600)/100))||'Nome da receita'}</div>}
    <div className="club-community-publish"><Send size={15}/>Publicar receita</div>
   </div>:<div className="club-community-post"><div className="club-community-author"><span className="club-community-avatar"><UserRound size={15}/></span><span><strong>Você</strong><small>Receita compartilhada · agora</small></span></div>
    <img className="club-community-photo" src={COVER} alt="" loading="lazy"/><strong className="club-community-title">{TITLE}</strong>
    <div className="club-community-reactions"><span className={`club-community-heart${likes?' is-liked':''}`}><Heart size={17} fill={likes?'currentColor':'none'}/>{likes}</span><span><MessageCircle size={17}/>{comments}</span></div>
    <div className="club-community-comments">{comments>=1&&<p className="club-comment-left"><img src={womanAvatar} alt="" width="26" height="26" loading="lazy"/><span>Como você fez?</span></p>}{comments>=2&&<p className="club-comment-right"><img src={manAvatar} alt="" width="26" height="26" loading="lazy"/><span>Adorei sua receita!</span></p>}</div>
   </div>}
   {!reduced&&running&&!uploading&&elapsed<6800&&<span className="club-community-cursor" style={point}><MousePointer2 size={26} fill="white" stroke="#141414" strokeWidth={1.5}/></span>}
  </div><figcaption className="sr-only">Simulação visual com imagem de drink e perfis gerados por IA. Nenhuma foto é enviada e nenhuma curtida ou comentário real é criado.</figcaption>
 </figure>;
}
