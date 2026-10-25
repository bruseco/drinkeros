import {afterEach,expect,it,vi} from 'vitest';
import {handleGuestCheckout} from '../../supabase/functions/club-guest-checkout/handler';
import {approvedInvoice,guestCanActivate} from '../../supabase/functions/_shared/clubGuest';
const token='a'.repeat(64);
const baseRow={id:'00000000-0000-0000-0000-000000000001',token_hash:token,email:'buyer@example.com',method:'card',amount:97,status:'pending',mp_id:'pre-1',created_at:new Date().toISOString(),last_checked_at:null,activation_claimed_at:null};
function setup({row=baseRow as any,purchase=null as any,user=null as any,claimed=true,offer={user_id:null,expires_at:new Date(Date.now()+900000).toISOString()},invoices=[] as any[]}={}){
 let current=row;let activations=0;const updates:any[]=[];
 const admin={from:vi.fn((table:string)=>{
  let operation='select',changes:any=null;
  const q:any={select:()=>q,eq:()=>q,is:()=>q,gte:()=>q,order:()=>q,limit:()=>q,update:(value:any)=>{operation='update';changes=value;return q},maybeSingle:async()=>({data:table==='club_guest_checkouts'?current:table==='clube_public_offers'?offer:purchase,error:null}),then:(resolve:any)=>{if(operation==='update'){updates.push(changes);current={...current,...changes};return Promise.resolve(resolve({data:[{id:current.id}],error:null}))}return Promise.resolve(resolve({data:[],error:null}))}};return q;
 }),rpc:vi.fn(async()=>{if(!current)current={...baseRow};return{data:[{claimed}],error:null}}),auth:{admin:{getUserById:vi.fn(async()=>({data:{user},error:null})),updateUserById:vi.fn(async()=>{activations++;return{error:null}})}}};
 const gateway=vi.fn(async(input:any,init:any)=>{const url=String(input);if(url.includes('/preapproval/search'))return new Response(JSON.stringify({results:[]}),{status:200});if(url.includes('/authorized_payments/search'))return new Response(JSON.stringify({results:invoices}),{status:200});if(url.includes('/mercadopago-webhook'))return new Response('{}',{status:200});if(init?.method==='POST')return new Response(JSON.stringify({id:'pre-1',status:'authorized'}),{status:200});return new Response('{}',{status:200})});
 vi.stubGlobal('fetch',gateway);vi.stubGlobal('AbortSignal',{timeout:()=>undefined});
 const request=async(body:any)=>{const response=await handleGuestCheckout(new Request('https://test/checkout',{method:'POST',body:JSON.stringify({checkout_token:token,...body})}),{admin,mpToken:'fake',supabaseUrl:'https://local',serviceKey:'internal'});return{status:response.status,body:await response.json()}};
 return{request,gateway,admin,updates,get activations(){return activations}};
}
afterEach(()=>vi.unstubAllGlobals());
it('does not treat subscription authorization as an approved payment',async()=>{
 const s=setup();const result=await s.request({action:'status'});expect(result.body.status).toBe('pending');expect(s.activations).toBe(0);
 expect(approvedInvoice({status:'authorized'})).toBe(false);expect(approvedInvoice({status:'processed',payment:{status:'approved'}})).toBe(true);
});
it('replaying create never submits another charge',async()=>{
 const s=setup();await s.request({action:'create',method:'card',formData:{token:'card'}});
 expect(s.gateway.mock.calls.filter(([,init])=>init?.method==='POST'&&!String(init?.body).includes('club-guest-checkout')).length).toBe(0);
});
it('rejects a fabricated/expired price before creating any charge',async()=>{
 const s=setup({row:null});const result=await s.request({action:'create',method:'card',expected_amount:97,formData:{token:'card',payer:{email:'buyer@example.com'}}});
 expect(result.status).toBe(409);expect(result.body.amount).toBe(197);expect(s.admin.rpc).not.toHaveBeenCalled();expect(s.gateway).not.toHaveBeenCalled();
});
it('does not allow low prices from an account-bound offer for a guest',async()=>{
 const s=setup({row:null,offer:{user_id:'existing',expires_at:new Date(Date.now()+900000).toISOString()}});const result=await s.request({action:'quote',public_offer_token:'b'.repeat(64)});expect(result.status).toBe(503);
});
it('blocks arbitrary tokens and unauthenticated claims without a matching paid purchase',async()=>{
 const s=setup();expect((await s.request({action:'activate',checkout_token:'invalid',password:'password123'})).status).toBe(400);
 expect((await s.request({action:'activate',password:'password123'})).body.status).toBe('pending');expect(s.activations).toBe(0);
});
it('never resets the password of an existing account',async()=>{
 const purchase={user_id:'existing',buyer_email:'buyer@example.com',status:'approved',product_type:'club',user_was_created:false};
 const s=setup({purchase,user:{id:'existing',email:'buyer@example.com',last_sign_in_at:null}});
 const result=await s.request({action:'activate',password:'password123'});expect(result.status).toBe(409);expect(s.activations).toBe(0);
});
it('permits a single activation only for a newly created matching paid account',async()=>{
 const purchase={user_id:'new',buyer_email:'buyer@example.com',status:'approved',product_type:'club',user_was_created:true};
 const user={id:'new',email:'buyer@example.com',last_sign_in_at:null};const s=setup({purchase,user});
 expect((await s.request({action:'activate',password:'password123'})).body.status).toBe('activated');
 expect((await s.request({action:'activate',password:'different'})).status).toBe(409);expect(s.activations).toBe(1);
 expect(guestCanActivate(purchase,{...user,last_sign_in_at:'today'},'buyer@example.com')).toBe(false);
 expect(guestCanActivate(purchase,user,'someone@example.com')).toBe(false);
});

it('creates one subscription using the server quote and only then waits for the actual charge',async()=>{
 const s=setup({row:null});const result=await s.request({action:'create',method:'card',public_offer_token:'b'.repeat(64),expected_amount:97,formData:{token:'fake-card',payer:{email:'buyer@example.com'}}});
 expect(result.body.status).toBe('pending');const charge=s.gateway.mock.calls.find(([url,init])=>String(url).endsWith('/preapproval')&&init?.method==='POST');expect(charge).toBeDefined();expect(JSON.parse(String(charge![1].body)).auto_recurring.transaction_amount).toBe(97);
 await s.request({action:'create',method:'card',expected_amount:97});expect(s.gateway.mock.calls.filter(([url,init])=>String(url).endsWith('/preapproval')&&init?.method==='POST')).toHaveLength(1);
 expect(s.updates.some(u=>'password' in u||'token' in u)).toBe(false);
});
