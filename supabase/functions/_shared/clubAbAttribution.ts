/** Analytics only: failure must never interrupt a payment already accepted by the gateway. */
export async function recordClubAbAttribution(admin:any,variant:unknown,reference:{guest_checkout_id?:string;preapproval_id?:string;payment_id?:string}) {
 if(variant!=='a'&&variant!=='b')return;
 const key=Object.keys(reference)[0];
 if(!key||!Object.values(reference)[0])return;
 try{const {error}=await admin.from('club_ab_attributions').upsert({...reference,variant},{onConflict:key,ignoreDuplicates:true});if(error)console.warn('[club-ab] attribution not saved');}catch{console.warn('[club-ab] attribution unavailable');}
}
