export const validGuestToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export async function guestTokenHash(token: string) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export function guestCanActivate(purchase: any, user: any, email: string) {
 return purchase?.status==='approved' && purchase?.product_type==='club' && purchase?.user_was_created===true
  && purchase?.buyer_email?.toLowerCase()===email && user?.email?.toLowerCase()===email
  && purchase?.user_id===user?.id && !user?.last_sign_in_at;
}
export function approvedInvoice(invoice: any) {
 return invoice?.status==='approved' || invoice?.payment?.status==='approved';
}
