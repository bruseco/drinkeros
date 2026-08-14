// Segunda oferta por e-mail (cupom) para leads que pegaram o desconto do presente
// e NÃO compraram. Roda por cron a cada 5 minutos.
//
// Trava anti-constrangimento: se houver QUALQUER sinal de compra (aprovada,
// pendente/em análise, ou acesso já concedido), o lead é marcado como não
// elegível e o e-mail nunca é enviado.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";
import { sendTransactionalEmail } from "../_shared/send-email-helper.ts";
import { OFFERS, SITE_URL, type OfferConfig } from "../_shared/offerLeads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const BRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// Parcelamento com juros do cliente (MP: 4,49% a.m.) — igual ao frontend.
function installmentLabel(price: number, count = 12) {
  const rate = 0.0449;
  const value = (price * rate * Math.pow(1 + rate, count)) / (Math.pow(1 + rate, count) - 1);
  return `${count}x de ${BRL(value)}`;
}

type Supa = ReturnType<typeof createClient>;

/** Retorna o motivo da inelegibilidade ou null quando o lead pode receber o e-mail. */
async function purchaseSignal(
  supabase: Supa,
  offer: OfferConfig,
  productId: string | null,
  lead: { email: string; user_id: string | null },
): Promise<string | null> {
  const email = lead.email.toLowerCase();

  // 1. Compras registradas (inclui convidado, via buyer_email)
  let q = supabase
    .from("purchases")
    .select("id, status, user_id, buyer_email, product_id, product_name")
    .limit(20);
  q = lead.user_id
    ? q.or(`user_id.eq.${lead.user_id},buyer_email.ilike.${email}`)
    : q.ilike("buyer_email", email);
  const { data: purchases } = await q;
  for (const p of (purchases || []) as any[]) {
    const matchesProduct = productId
      ? p.product_id === productId
      : String(p.product_name || "").toLowerCase().includes(offer.productSlug);
    if (!matchesProduct) continue;
    const status = String(p.status || "").toLowerCase();
    if (["approved", "paid", "completed", "pending", "in_process", "in_mediation", "authorized"].includes(status)) {
      return `purchase:${status}`;
    }
  }

  // 2. Acesso já concedido ao combo
  if (lead.user_id && productId && offer.productType === "combo") {
    const { data: access } = await supabase
      .from("user_combos")
      .select("id")
      .eq("user_id", lead.user_id)
      .eq("combo_id", productId)
      .limit(1);
    if (access && access.length > 0) return "access_granted";
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (authFail) return authFail;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const result = { sent: 0, skipped: 0, errors: [] as string[] };

  try {
    for (const offer of Object.values(OFFERS)) {
      const cutoff = new Date(Date.now() - offer.followupMinutes * 60_000).toISOString();

      const { data: leads, error } = await supabase
        .from("landing_offer_leads")
        .select("id, name, email, user_id, discount_token, created_at")
        .eq("page_key", offer.pageKey)
        .is("email_sent_at", null)
        .is("ineligible_at", null)
        .lte("created_at", cutoff)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      if (!leads || leads.length === 0) continue;

      // ID do produto (para casar as compras)
      const table = offer.productType === "combo"
        ? "combos"
        : offer.productType === "course"
        ? "courses"
        : offer.productType === "ebook"
        ? "ebooks"
        : "packages";
      const { data: prod } = await supabase
        .from(table)
        .select("id")
        .eq("slug", offer.productSlug)
        .maybeSingle();
      const productId = (prod as any)?.id ?? null;

      for (const raw of leads as any[]) {
        const lead = raw as { id: string; name: string | null; email: string; user_id: string | null; discount_token: string };
        try {
          const signal = await purchaseSignal(supabase, offer, productId, lead);
          if (signal) {
            await supabase
              .from("landing_offer_leads")
              .update({ ineligible_at: new Date().toISOString(), ineligible_reason: signal })
              .eq("id", lead.id);
            result.skipped++;
            continue;
          }

          const expiresAt = new Date(Date.now() + offer.couponValidHours * 3600_000).toISOString();
          const offerUrl = `${SITE_URL}${offer.landingPath}?c=${lead.discount_token}`;
          const firstName = String(lead.name || "").trim().split(" ")[0] || undefined;

          const sendRes = await sendTransactionalEmail({
            templateName: offer.emailTemplate,
            recipientEmail: lead.email,
            idempotencyKey: `${offer.emailTemplate}-${lead.id}`,
            templateData: {
              userName: firstName,
              offerUrl,
              previousPriceFormatted: BRL(offer.revealPrice),
              priceFormatted: BRL(offer.couponPrice),
              installmentsFormatted: installmentLabel(offer.couponPrice),
              expiresInHours: offer.couponValidHours,
            },
          });
          if (!sendRes.success) throw new Error(sendRes.error || "falha no envio");

          await supabase
            .from("landing_offer_leads")
            .update({ email_sent_at: new Date().toISOString(), token_expires_at: expiresAt })
            .eq("id", lead.id);
          result.sent++;
        } catch (e) {
          result.errors.push(`${lead.email}: ${(e as Error).message}`);
        }
      }
    }

    console.log("[send-offer-followup-emails]", result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-offer-followup-emails]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
