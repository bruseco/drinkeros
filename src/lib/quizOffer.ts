import {supabase} from '@/integrations/supabase/client';
import {quizAdParams, type Answers, type ProfileId, type QuizPath} from './quizLogic';
const KEY='drinkeros:quiz-offer:v2';
let memory='';
export function quizOfferToken(){if(memory)return memory;try{memory=localStorage.getItem(KEY)||'';}catch{}if(!/^[a-f0-9]{64}$/.test(memory)){memory=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem(KEY,memory);}catch{}}return memory;}
export async function quizCall(action:string,body:Record<string,unknown>={}){const {data,error}=await supabase.functions.invoke('quiz-offer',{body:{action,token:quizOfferToken(),...body}});if(error||data?.error)throw Error(data?.error||'Não foi possível consultar a oferta. Tente novamente.');return data;}
export async function completeQuiz(answers:Answers,search:string){return quizCall('complete',{answers,attribution:quizAdParams(search)});}
export type QuizQuote={session_id:string;path:QuizPath;recommended:ProfileId;product:ProfileId;price:number;full_price:number;expires_at:string;server_now:string;active:boolean;attribution:Record<string,string>;alternatives?:Array<{product:ProfileId;price:number;full_price:number}>};
export async function fetchQuizQuote(product:ProfileId):Promise<QuizQuote>{return quizCall('quote',{product});}

export async function trackQuizOffer(q:QuizQuote,event:import('./funnelTracking').FunnelEvent,extra:Record<string,unknown>={}){
 const {trackFunnelAsync}=await import('./funnelTracking');
 const opts={amountCents:Math.round(q.price*100),metadata:{...q.attribution,path:q.path,product:q.product,profile:q.product,quiz_session_id:q.session_id,...extra}};
 await Promise.all([trackFunnelAsync('quiz',event,opts),trackFunnelAsync(`quiz-offer-${q.product}`,event,opts)]);
}
