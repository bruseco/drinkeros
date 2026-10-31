import {recordClubAbAttribution} from '../_shared/clubAbAttribution.ts';
import { approvedInvoice, guestCanActivate, guestTokenHash, validGuestToken } from '../_shared/clubGuest.ts';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const site='https://drinkeros.com';
export async function handleGuestCheckout(req:Request,{admin,mpToken,supabaseUrl,serviceKey}:{admin:any;mpToken:string;supabaseUrl:string;serviceKey:string}){
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method==='GET')return json({club_guest_checkout_version:2,club_monthly_b_version:1,club_ab_attribution_version:1});
 if(req.method!=='POST')return json({error:'Método inválido'},405);
 try{
  const body=await req.json();
  const action=body.action;
  if(body.billing_plan!==undefined && body.billing_plan!=='monthly-b')return json({error:'Plano inválido'},400);
  const monthly=body.billing_plan==='monthly-b';
  const token=body.checkout_token;
  if(!validGuestToken(token))return json({error:'Identificador inválido'},400);
  const hash=await guestTokenHash(token);
  if(!mpToken)throw Error('Pagamento temporariamente indisponível');
  const mp=async(path:string,options:RequestInit={})=>{
   const response=await fetch('https://api.mercadopago.com'+path,{...options,signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${mpToken}`,'Content-Type':'application/json',...options.headers}});
   const data=await response.json();
   return {ok:response.ok,status:response.status,data};
  };
  const sync=async(type:string,id:string)=>{
   const response=await fetch(`${supabaseUrl}/functions/v1/mercadopago-webhook`,{method:'POST',headers:{'Content-Type':'application/json','x-internal-mp-sync':serviceKey},body:JSON.stringify({type,data:{id},source:'club-guest-checkout'}),signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Confirmação em processamento. Aguarde alguns instantes.');
  };
  const read=async()=>{const result=await admin.from('club_guest_checkouts').select('*').eq('token_hash',hash).maybeSingle();if(result.error)throw result.error;return result.data;};
  const quote=async()=>{
   if(monthly)return {price:7,billing_months:1};
   if(!validGuestToken(body.public_offer_token))return {price:197};
   const offerHash=await guestTokenHash(body.public_offer_token);
   const {data,error}=await admin.from('clube_public_offers').select('user_id,expires_at').eq('token_hash',offerHash).maybeSingle();
   if(error)throw error;
   if(data?.user_id)throw Error('Faça login para usar a oferta vinculada à sua conta.');
   return {price:data?.expires_at&&new Date(data.expires_at).getTime()>Date.now()?87:197};
  };
  if(action==='quote')return json(await quote());
  let row=await read();
  if(row && (row.billing_months===1)!==monthly)return json({error:'Esta tentativa pertence a outro plano. Retome a tela original.',code:'checkout_plan_mismatch'},409);
  if(action==='create'&&!row){
   const email=String(body.formData?.payer?.email||'').trim().toLowerCase();
   if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Informe um e-mail válido para receber seu acesso.'},400);
   const method=body.method;
   if(monthly && method!=='card')return json({error:'Esta assinatura aceita somente cartão de crédito'},400);
   if(!['card','pix'].includes(method))return json({error:'Método inválido'},400);
   const {price}=await quote();
   if(Number(body.expected_amount)!==price)return json({error:'O preço foi atualizado. Confira o valor antes de pagar.',code:'public_club_price_changed',amount:price},409);
   if(method==='card'&&!body.formData?.token)return json({error:'Confira os dados do cartão.'},400);
   const {data:recent,error:countError}=await admin.from('club_guest_checkouts').select('id',{count:'exact',head:false}).eq('email',email).gte('created_at',new Date(Date.now()-900000).toISOString());
   if(countError)throw countError;
   if((recent?.length||0)>=5)return json({error:'Muitas tentativas. Aguarde alguns minutos ou fale com o atendimento.'},429);
   const claimed=await admin.rpc(monthly?'claim_club_monthly_checkout':'claim_club_guest_checkout',monthly?{_hash:hash,_email:email}:{_hash:hash,_email:email,_method:method,_amount:price});
   if(claimed.error)throw claimed.error;
   row=await read();
   if(!row || (row.billing_months===1)!==monthly)return json({error:'Esta tentativa pertence a outro plano.',code:'checkout_plan_mismatch'},409);
   if(claimed.data?.[0]?.claimed){
    await recordClubAbAttribution(admin,body.club_ab_variant,{guest_checkout_id:row.id});
    // Only this request may submit a charge. Replays poll/reconcile; they never POST again.
    if(method==='card'){
     const duplicate=await mp(`/preapproval/search?payer_email=${encodeURIComponent(email)}&limit=100`);
     if(!duplicate.ok){await admin.from('club_guest_checkouts').update({status:'failed'}).eq('id',row.id);return json({error:'Não foi possível verificar assinaturas existentes. Tente novamente mais tarde.',code:'payment_rejected'},503);}
     if((duplicate.data.results||[]).some((r:any)=>['authorized','pending'].includes(r.status))){
      await admin.from('club_guest_checkouts').update({status:'failed'}).eq('id',row.id);
      return json({error:'Já existe uma assinatura neste e-mail. Faça login ou recupere sua senha; não cobramos novamente.',code:'subscription_exists'},409);
     }
    }
    const external_reference=`club-guest:${row.id}:${monthly?'clube':'clube-anual'}`;
    const payer=body.formData.payer;
    const payload=method==='card'?{reason:monthly?'Clube dos Drinkeros · Mensal':'Clube dos Drinkeros · Anual',external_reference,payer_email:email,card_token_id:body.formData.token,auto_recurring:{frequency:monthly?1:12,frequency_type:'months',transaction_amount:price,currency_id:'BRL'},back_url:`${site}/checkout/club/${monthly?'clube-mensal-b':'clube-anual'}`,status:'authorized'}:{transaction_amount:price,description:'Clube dos Drinkeros · Anual',payment_method_id:'pix',external_reference,payer:{email,identification:payer.identification},notification_url:`${supabaseUrl}/functions/v1/mercadopago-webhook`,metadata:{product_type:'club',product_id:'club',product_slug:'clube-anual',access_period_days:'365',buyer_email:email,buyer_name:[payer.first_name,payer.last_name].filter(Boolean).join(' '),buyer_cpf:payer.identification?.number||'',guest_checkout_id:row.id}};
    const recheck=await quote();
    if(recheck.price!==price){await admin.from('club_guest_checkouts').update({status:'failed'}).eq('id',row.id);return json({error:'A oferta expirou. Confira o novo preço antes de pagar.',code:'public_club_price_changed',amount:recheck.price},409);}
    const created=await mp(method==='card'?'/preapproval':'/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':row.id},body:JSON.stringify(payload)});
    if(!created.ok&&created.status>=500)return json({status:'pending',amount:row.amount});
    if(!created.ok){await admin.from('club_guest_checkouts').update({status:'failed'}).eq('id',row.id);return json({error:'Pagamento não concluído. Confira os dados e tente novamente.',code:'payment_rejected'},400);}
    const saved=await admin.from('club_guest_checkouts').update({mp_id:String(created.data.id),status:'pending'}).eq('id',row.id);
    if(saved.error)throw saved.error;
    row={...row,mp_id:String(created.data.id),status:'pending'};
   }
  }
  if(!row)return json({error:'Checkout não encontrado',code:'checkout_not_found'},404);
  if(!['create','status','activate'].includes(action))return json({error:'Ação inválida'},400);
  if(Date.now()-new Date(row.created_at).getTime()>7*86400000)return json({error:'Este acesso expirou. Use o link enviado por e-mail ou faça login.'},410);
  if(row.status==='failed')return json({status:'failed',message:'Pagamento não concluído. Você pode tentar novamente.'});
  const externalRef=`club-guest:${row.id}:${monthly?'clube':'clube-anual'}`;
  if(!row.mp_id){
   // A network failure may have happened after the gateway accepted the POST.
   const search=await mp(row.method==='card'?`/preapproval/search?payer_email=${encodeURIComponent(row.email)}&limit=100`:`/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}`);
   if(!search.ok)return json({status:'pending',amount:row.amount});
   const found=(search.data.results||[]).find((r:any)=>r.external_reference===externalRef);
   if(found){row.mp_id=String(found.id);await admin.from('club_guest_checkouts').update({mp_id:row.mp_id,status:'pending'}).eq('id',row.id);}
   else return json({status:'pending',amount:row.amount});
  }
  let pix:any=null;
  if(!row.last_checked_at||Date.now()-new Date(row.last_checked_at).getTime()>4000){
   await admin.from('club_guest_checkouts').update({last_checked_at:new Date().toISOString()}).eq('id',row.id);
   if(row.method==='pix'){
    const payment=await mp(`/v1/payments/${encodeURIComponent(row.mp_id)}`);
    if(!payment.ok)throw Error('Não foi possível consultar o pagamento. Aguarde.');
    if(payment.data.external_reference!==externalRef)throw Error('Pagamento inválido');
    if(['rejected','cancelled','refunded','charged_back'].includes(payment.data.status))return json({status:'failed',message:'Pagamento não concluído ou cancelado.'});
    pix=payment.data.point_of_interaction?.transaction_data;
    if(payment.data.status==='approved')await sync('payment',row.mp_id);
   }else{
    const invoices=await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(row.mp_id)}`);
    if(invoices.ok)for(const invoice of invoices.data.results||[])if(approvedInvoice(invoice))await sync('authorized_payment',String(invoice.id));
   }
  }
  let query=admin.from('purchases').select('user_id,buyer_email,user_was_created,status,product_type,transaction_id,metadata').eq('gateway','mercado_pago').eq('product_type','club').eq('status','approved');
  query=query.eq('metadata->>guest_checkout_id',row.id).eq('amount_paid',row.amount);
  const purchaseResult=await query.order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(purchaseResult.error)throw purchaseResult.error;
  const purchase=purchaseResult.data;
  if(!purchase)return json({status:'pending',amount:row.amount,...(pix?{pix:{qr_code:pix.qr_code,qr_code_base64:pix.qr_code_base64}}:{})});
  if(purchase.buyer_email?.toLowerCase()!==row.email)throw Error('Não foi possível validar o acesso');
  const auth=await admin.auth.admin.getUserById(purchase.user_id);
  if(auth.error)throw auth.error;
  const canActivate=guestCanActivate(purchase,auth.data.user,row.email)&&!row.activation_claimed_at;
  if(action==='activate'){
   if(!canActivate)return json({error:'Faça login com sua senha atual ou use o link recebido por e-mail.',code:'existing_account'},409);
   const password=String(body.password||'');
   if(password.length<8)return json({error:'Use uma senha com pelo menos 8 caracteres.'},400);
   const claim=await admin.from('club_guest_checkouts').update({activation_claimed_at:new Date().toISOString()}).eq('id',row.id).is('activation_claimed_at',null).select('id');
   if(claim.error||!claim.data?.length)return json({error:'Acesso já utilizado. Faça login ou recupere sua senha.'},409);
   const updated=await admin.auth.admin.updateUserById(purchase.user_id,{password});
   if(updated.error)throw Error('Não foi possível definir a senha. Use o link enviado por e-mail.');
   return json({status:'activated',email:row.email});
  }
  return json({status:'paid',email:row.email,can_activate:canActivate,amount:row.amount});
 }catch(e){console.error('[club-guest-checkout]',e instanceof Error?e.message:'error');return json({error:'Não foi possível concluir esta etapa. Aguarde e confira o status antes de tentar pagar novamente.'},503);}
}
