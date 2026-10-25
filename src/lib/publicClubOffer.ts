import { supabase } from '@/integrations/supabase/client';
const KEY = 'drinkeros:public-club-offer:v2';
let memoryToken: string | null = null;
export function publicClubOfferToken(reset = false) {
  if(reset){memoryToken=null;try{localStorage.removeItem(KEY)}catch{/* Storage unavailable. */}}
  if (memoryToken) return memoryToken;
  try { const stored = localStorage.getItem(KEY); if (stored && /^[a-f0-9]{64}$/.test(stored)) return memoryToken = stored; } catch { /* Keep an in-memory token when storage is unavailable. */ }
  memoryToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2,'0')).join('');
  try { localStorage.setItem(KEY,memoryToken); } catch { /* No storage permission. */ }
  return memoryToken;
}
export type PublicClubOffer = { server_now: string; revealed_at: string | null; expires_at: string | null; price: number };
export async function fetchPublicClubOffer(reveal = false, newVisit = false): Promise<PublicClubOffer> {
  let { data, error } = await supabase.rpc('clube_public_offer' as never, { _token: publicClubOfferToken(), _reveal: reveal, _new_visit: newVisit } as never);
  if(error?.message==='Oferta vinculada a outra conta'){
    const retried=await supabase.rpc('clube_public_offer' as never,{_token:publicClubOfferToken(true),_reveal:reveal,_new_visit:newVisit} as never);
    data=retried.data;error=retried.error;
  }
  if (error) throw error;
  const row = (data as unknown as PublicClubOffer[])?.[0];
  if (!row || ![47,87,97,197].includes(Number(row.price))) throw new Error('Não foi possível confirmar o preço da oferta.');
  return { ...row, price: Number(row.price) };
}
