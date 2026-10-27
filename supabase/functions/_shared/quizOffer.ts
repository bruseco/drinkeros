import { type ProfileId, PROFILES } from "./quizRules.ts";
export class QuizPriceChanged extends Error {
  constructor(public amount: number) {
    super("O preço foi atualizado. Confira o novo valor antes de pagar.");
  }
}
export async function quizTokenHash(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    throw Error("Conclua o quiz para acessar esta oferta.");
  }
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function resolveQuizQuote(
  admin: any,
  token: unknown,
  productType: string,
  slug: string,
  expected?: unknown,
  activate = false,
) {
  const product = Object.values(PROFILES).find((p) =>
    p.productType === productType && p.slug === slug
  )?.id;
  if (!product) throw Error("Produto não pertence ao quiz.");
  const { data, error } = await admin.rpc("quiz_quote", {
    _hash: await quizTokenHash(token),
    _product: product,
    _activate: activate,
  });
  if (error || !data?.[0]) {
    throw Error(
      "Não foi possível validar sua oferta. Volte ao resultado do quiz.",
    );
  }
  const q = data[0];
  if (
    expected !== undefined &&
    Math.round(Number(expected) * 100) !== Math.round(Number(q.price) * 100)
  ) throw new QuizPriceChanged(Number(q.price));
  return {
    ...q,
    price: Number(q.price),
    full_price: Number(q.full_price),
    product: product as ProfileId,
  };
}
export async function recordQuizPayment(
  admin: any,
  q: any,
  gateway: string,
  id: string,
  productId: string,
  amount: number,
) {
  const { error } = await admin.from("quiz_payment_attributions").upsert({
    gateway,
    transaction_id: id,
    session_id: q.session_id,
    product: q.product,
    product_id: productId,
    amount,
    path: q.path,
    attribution: q.attribution,
  }, { onConflict: "gateway,transaction_id", ignoreDuplicates: true });
  if (error) {
    console.warn(
      "[quiz] Payment accepted; attribution requires reconciliation",
    );
  }
}
export async function quizPaymentHash(token: unknown, product: string) {
  const h = await quizTokenHash(token);
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(h + ":" + product),
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
