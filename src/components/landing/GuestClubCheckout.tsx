import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { ArrowLeft, CheckCircle2, Copy, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { publicClubOfferToken } from '@/lib/publicClubOffer';
import logo from '@/assets/logotipo-drinkeros.png';

const STORAGE='drinkeros:club-guest-attempt:v1';
function newToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}
type Result={status?:string;amount?:number;email?:string;can_activate?:boolean;pix?:{qr_code:string;qr_code_base64:string}};
export default function GuestClubCheckout(){
 const navigate=useNavigate();
 const token=useRef('');
 const [ready,setReady]=useState(false),[amount,setAmount]=useState(197),[method,setMethod]=useState<'card'|'pix'>('card');
 const [started,setStarted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [result,setResult]=useState<Result>({}),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const submitting=useRef(false);
 const call=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
  const {data,error}=await supabase.functions.invoke('club-guest-checkout',{body:{action,checkout_token:token.current,public_offer_token:publicClubOfferToken(),...extra}});
  let payload=data;
  if(error){try{payload=await (error as any).context.json()}catch{/* Network errors preserve the attempt for reconciliation. */}}
  if(error||payload?.error){const failure=new Error(payload?.error||'Não foi possível consultar o pagamento. Aguarde e tente atualizar o status.');Object.assign(failure,{code:payload?.code,amount:payload?.amount});throw failure;}
  return payload;
 },[]);
 const accept=useCallback((next:Result)=>{setResult(previous=>({...previous,...next}));if(next.amount)setAmount(Number(next.amount));setError('');},[]);
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   try{
    let stored='';try{stored=sessionStorage.getItem(STORAGE)||''}catch{/* Keep memory-only fallback. */}
    token.current=/^[a-f0-9]{64}$/.test(stored)?stored:newToken();
    if(stored){setStarted(true);try{const status=await call('status');if(!cancelled)accept(status);}catch(e){if(!cancelled){setError((e as Error).message);if((e as Error&{code?:string}).code==='checkout_not_found')setResult({status:'failed'});}}}
    const quote=await call('quote');
    if(!cancelled&&!stored)setAmount(Number(quote.price));
    const key=await supabase.functions.invoke('get-mp-public-key');
    if(key.error||!key.data?.publicKey)throw Error('Não foi possível carregar o pagamento. Recarregue a página.');
    initMercadoPago(key.data.publicKey,{locale:'pt-BR'});
    if(!cancelled)setReady(true);
   }catch(e){if(!cancelled)setError((e as Error).message);}
  })();return()=>{cancelled=true};
 },[call,accept]);
 const refresh=useCallback(async()=>{try{accept(await call('status'))}catch(e){setError((e as Error).message);if((e as Error&{code?:string}).code==='checkout_not_found')setResult({status:'failed'});}},[call,accept]);
 useEffect(()=>{
  if(!started||result.status==='paid'||result.status==='activated'||result.status==='failed')return;
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},5000);
  return()=>clearInterval(timer);
 },[started,result.status,refresh]);
 const retry=()=>{token.current=newToken();try{sessionStorage.removeItem(STORAGE)}catch{}setStarted(false);setResult({});setError('');};
 const submit=async(formData:any)=>{
  if(submitting.current)return;submitting.current=true;setBusy(true);setError('');
  try{
   try{sessionStorage.setItem(STORAGE,token.current)}catch{}
   setStarted(true);
   accept(await call('create',{method,formData,expected_amount:amount}));
  }catch(e){
   const failure=e as Error&{code?:string;amount?:number};setError(failure.message);
   if(failure.code==='public_club_price_changed'){retry();setAmount(Number(failure.amount));setError(failure.message);}
   if(failure.code==='payment_rejected'||failure.code==='subscription_exists')setResult({status:'failed'});
  }finally{submitting.current=false;setBusy(false)}
 };
 const activate=async(event:React.FormEvent)=>{
  event.preventDefault();if(password!==confirm){setError('As senhas não coincidem.');return;}
  setBusy(true);setError('');
  try{
   const activated=await call('activate',{password});
   const signed=await supabase.auth.signInWithPassword({email:activated.email,password});
   try{sessionStorage.removeItem(STORAGE)}catch{}
   if(signed.error||!signed.data?.user){navigate('/login?redirect=/clube/boas-vindas');return;}
   setResult(previous=>({...previous,status:'activated'}));navigate('/clube/boas-vindas',{replace:true});
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const paid=result.status==='paid'||result.status==='activated';
 return <main className="min-h-screen bg-[#141414] text-white px-4 py-7">
  <header className="max-w-4xl mx-auto flex items-center justify-between mb-9"><Link to="/clube-receitas" className="flex items-center gap-2 text-sm"><ArrowLeft size={17}/>Voltar</Link><img src={logo} alt="Drinkeros" className="h-7 w-auto"/><ShieldCheck className="text-green-400"/></header>
  <section className="max-w-lg mx-auto bg-white rounded-2xl p-5 sm:p-8 text-gray-900">
   <h1 className="text-2xl font-bold mb-2">{paid?'Pagamento confirmado':'Entre para o Clube'}</h1>
   {!paid&&<><p className="text-sm text-gray-600">Pague primeiro. Defina sua senha depois da confirmação.</p><p className="text-4xl font-bold mt-5 mb-1">R$ {amount}</p><p className="text-sm text-gray-500 mb-6">Acesso por 12 meses</p></>}
   {error&&<p role="alert" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm my-4">{error}</p>}
   {paid?<>
    <CheckCircle2 className="text-green-600 my-4" size={40}/><p className="text-sm mb-5">Seu acesso está vinculado a {result.email}. Enviamos também a confirmação por e-mail.</p>
    {result.can_activate&&result.status!=='activated'?<form onSubmit={activate} className="space-y-4"><h2 className="font-semibold">Defina sua senha para entrar</h2><label className="block text-sm">Senha<input className="block border rounded-lg p-3 w-full mt-1" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block text-sm">Confirmar senha<input className="block border rounded-lg p-3 w-full mt-1" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button disabled={busy} className="rounded-lg bg-green-700 text-white p-3 w-full font-semibold">{busy?'Salvando…':'Criar senha e entrar no Clube'}</button></form>:<Link className="block text-center rounded-lg bg-green-700 text-white p-3" to="/login?redirect=/clube/boas-vindas">Entrar com minha conta</Link>}
    <p className="mt-5 text-xs text-gray-500">Os dados da nota fiscal podem ser completados após o acesso, sem bloquear sua entrada.</p>
   </>:started?<div className="space-y-4">
    {busy?<p className="flex gap-2"><Loader2 className="animate-spin"/>Processando pagamento…</p>:result.status==='failed'?<><p>O pagamento não foi concluído.</p><button onClick={retry} className="underline">Voltar ao pagamento</button></>:<>
     <h2 className="font-semibold">Aguardando confirmação do pagamento</h2><p className="text-sm text-gray-600">Não é necessário pagar novamente. Esta tela será atualizada automaticamente.</p>
     {result.pix&&<><img className="w-56 mx-auto" alt="QR Code Pix" src={`data:image/png;base64,${result.pix.qr_code_base64}`}/><button className="border rounded-lg p-3 flex items-center gap-2" onClick={()=>{navigator.clipboard.writeText(result.pix!.qr_code).then(()=>toast.success('Código Pix copiado')).catch(()=>setError('Não foi possível copiar. Use o código abaixo.'))}}><Copy size={17}/>Copiar código Pix</button><textarea readOnly value={result.pix.qr_code} className="w-full border rounded p-2 text-xs" aria-label="Código Pix"/></>}
     <button className="underline text-sm" onClick={()=>void refresh()}>Atualizar status</button>
    </>}
   </div>:ready?<>
    <div className="grid grid-cols-2 gap-2 mb-5">{(['card','pix'] as const).map(option=><button key={option} onClick={()=>setMethod(option)} aria-pressed={method===option} className={`p-3 rounded-lg border ${method===option?'border-green-700 bg-green-50':'border-gray-200'}`}>{option==='card'?'Cartão':'Pix'}</button>)}</div>
    <Payment key={`${method}-${amount}`} initialization={{amount}} customization={{paymentMethods:{creditCard:method==='card'?'all':undefined,bankTransfer:method==='pix'?['pix']:undefined,maxInstallments:1,minInstallments:1},visual:{style:{theme:'default'},hideFormTitle:true}}} onSubmit={({formData})=>submit(formData)} onError={()=>setError('Não foi possível carregar o formulário. Recarregue a página.')}/>
    <p className="text-xs text-gray-500 mt-5">{method==='card'?'Assinatura anual com renovação automática pelo valor contratado.':'Pix: 12 meses de acesso, sem renovação automática.'} Ao continuar, você concorda com os <Link className="underline" to="/termos-de-uso">Termos de uso</Link> e a <Link className="underline" to="/politica-de-privacidade">Política de privacidade</Link>.</p>
   </>:!error?<Loader2 className="animate-spin mx-auto my-6"/>:<button className="underline" onClick={()=>window.location.reload()}>Recarregar</button>}
  </section>
 </main>;
}
