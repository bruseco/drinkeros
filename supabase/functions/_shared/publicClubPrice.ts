export class PublicClubPriceChanged extends Error {
  constructor(public amount: number) { super('A oferta expirou ou o preço foi atualizado. Confira o valor antes de pagar novamente.'); }
}
export async function publicClubPrice(admin: any, userId: string, expectedAmount: unknown, required = false) {
  const { data, error } = await admin.rpc('clube_public_checkout_quote',{_user_id:userId});
  if(error) throw new Error('Não foi possível validar o preço do Clube. Atualize a página.');
  if(!data?.[0]) { if(required)throw new Error('Oferta não vinculada à conta. Atualize a página.');return null; }
  const amount=Number(data[0].price);
  if(![47,87,97,197].includes(amount))throw new Error('Preço do Clube inválido.');
  if(Number(expectedAmount)!==amount)throw new PublicClubPriceChanged(amount);
  return amount;
}
