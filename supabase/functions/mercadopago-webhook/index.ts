// Webhook do Mercado Pago: recebe notificações de pagamento, busca detalhes via API,
// registra evento e libera acesso ao produto (curso/ebook/combo/pacote) quando approved.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { fireCapiPurchaseFromWebhook } from "../_shared/metaCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

const ACCESS_TABLE_MAP: Record<string, { table: string; fk: string }> = {
  course: { table: "user_courses", fk: "course_id" },
  ebook: { table: "user_ebooks", fk: "ebook_id" },
  combo: { table: "user_combos", fk: "combo_id" },
  package: { table: "user_packages", fk: "package_id" },
};

async function recordPurchase(supabase: any, p: {
  userId: string;
  productId?: string | null;
  productName: string;
  productType: string;
  amountPaid: number;
  currency: string;
  status: string;
  transactionId: string;
  metadata?: Record<string, unknown>;
}) {
  if (!p.transactionId || !(p.amountPaid > 0)) return;
  const { error } = await supabase.from("purchases").upsert(
    {
      user_id: p.userId,
      product_id: p.productId ?? null,
      product_name: p.productName,
      product_type: p.productType,
      gateway: "mercado_pago",
      amount_paid: p.amountPaid,
      currency: (p.currency || "BRL").toUpperCase(),
      status: p.status,
      transaction_id: p.transactionId,
      metadata: p.metadata || {},
    },
    { onConflict: "gateway,transaction_id" },
  );
  if (error) console.error("[mp-webhook] purchases-upsert-error", error);

  // Dispara Purchase via Meta Conversions API (server-side, à prova de adblock/ITP)
  await fireCapiPurchaseFromWebhook(supabase, {
    userId: p.userId,
    transactionId: p.transactionId,
    gateway: "mercado_pago",
    amount: p.amountPaid,
    currency: p.currency || "BRL",
    productName: p.productName,
    productType: p.productType,
    productId: p.productId ?? null,
  });
}

async function grantClubAccess(supabase: any, userId: string, payment: any, paymentId: string, periodDays: number) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const { data: existingPayment } = await supabase
    .from("vip_payments")
    .select("id")
    .eq("metadata->>mercadopago_payment_id", String(paymentId))
    .maybeSingle();

  if (existingPayment?.id) {
    await supabase.from("user_plans").upsert({
      user_id: userId,
      plan: "vip",
      source: "mercadopago",
      activated_at: now.toISOString(),
      expires_at: periodEnd.toISOString(),
    }, { onConflict: "user_id" });
    return;
  }

  await supabase.from("vip_payments").insert({
    user_id: userId,
    amount: Number(payment?.transaction_amount || 0),
    currency: String(payment?.currency_id || "BRL").toUpperCase(),
    status: "paid",
    payment_method: payment?.payment_method_id === "pix" ? "pix" : "card",
    paid_at: now.toISOString(),
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
    metadata: { mercadopago_payment_id: String(paymentId), source: "mercadopago" },
  });

  await supabase.from("user_plans").upsert({
    user_id: userId,
    plan: "vip",
    source: "mercadopago",
    activated_at: now.toISOString(),
    expires_at: periodEnd.toISOString(),
  }, { onConflict: "user_id" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const topic = body?.type || body?.topic || url.searchParams.get("topic") || url.searchParams.get("type");
    const resourceId = body?.data?.id || url.searchParams.get("id") || url.searchParams.get("data.id");

    console.log("[mp-webhook] received:", { topic, resourceId, body });

    // ============ Assinatura recorrente do Clube (preapproval) ============
    if ((topic === "preapproval" || topic === "subscription_preapproval") && resourceId) {
      const r = await fetch(`${MP_API}/preapproval/${resourceId}`, {
        headers: { "Authorization": `Bearer ${mpToken}` },
      });
      const pre = await r.json();
      if (!r.ok) {
        console.error("[mp-webhook] preapproval fetch failed:", pre);
        return new Response(JSON.stringify({ ok: false }), { status: 200, headers: corsHeaders });
      }
      console.log("[mp-webhook] preapproval status:", pre?.status);
      return new Response(JSON.stringify({ ok: true, preapproval: pre?.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Cobrança recorrente da assinatura (authorized_payment) ============
    if ((topic === "subscription_authorized_payment" || topic === "authorized_payment") && resourceId) {
      const r = await fetch(`${MP_API}/authorized_payments/${resourceId}`, {
        headers: { "Authorization": `Bearer ${mpToken}` },
      });
      const ap = await r.json();
      if (!r.ok) {
        console.error("[mp-webhook] authorized_payment fetch failed:", ap);
        return new Response(JSON.stringify({ ok: false }), { status: 200, headers: corsHeaders });
      }
      if (ap?.status !== "approved") {
        return new Response(JSON.stringify({ ok: true, status: ap?.status }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const preapprovalId = ap?.preapproval_id;
      const preR = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
        headers: { "Authorization": `Bearer ${mpToken}` },
      });
      const pre = await preR.json();
      const externalRef = pre?.external_reference as string | undefined;
      const payerEmail = pre?.payer_email;
      let userId: string | null = null;
      if (externalRef?.startsWith("club:")) userId = externalRef.split(":")[1] || null;
      if (!userId && payerEmail) {
        const { data: profile } = await supabase
          .from("profiles").select("user_id").eq("email", payerEmail).maybeSingle();
        userId = profile?.user_id || null;
      }
      if (!userId) {
        return new Response(JSON.stringify({ ok: true, pending_user: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isAnnual = pre?.auto_recurring?.frequency === 12;
      const now = new Date();
      const periodEnd = new Date(now.getTime() + (isAnnual ? 365 : 31) * 24 * 60 * 60 * 1000);

      const { data: existing } = await supabase
        .from("vip_payments").select("id")
        .eq("metadata->>mp_authorized_payment_id", String(resourceId))
        .maybeSingle();

      if (!existing?.id) {
        await supabase.from("vip_payments").insert({
          user_id: userId,
          amount: Number(ap?.transaction_amount || pre?.auto_recurring?.transaction_amount || 0),
          currency: "BRL",
          status: "paid",
          payment_method: "card",
          paid_at: now.toISOString(),
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          metadata: {
            source: "mercadopago",
            mp_authorized_payment_id: String(resourceId),
            mp_preapproval_id: String(preapprovalId),
          },
        });
      }

      await supabase.from("user_plans").upsert({
        user_id: userId,
        plan: "vip",
        source: "mercadopago",
        activated_at: now.toISOString(),
        expires_at: periodEnd.toISOString(),
      }, { onConflict: "user_id" });

      await recordPurchase(supabase, {
        userId,
        productId: null,
        productName: isAnnual ? "Clube dos Drinkeros · Anual" : "Clube dos Drinkeros · Mensal",
        productType: "club",
        amountPaid: Number(ap?.transaction_amount || pre?.auto_recurring?.transaction_amount || 0),
        currency: "BRL",
        status: "approved",
        transactionId: String(resourceId),
        metadata: { mp_preapproval_id: String(preapprovalId) },
      });

      return new Response(JSON.stringify({ ok: true, recurring: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = resourceId;
    if (topic !== "payment" || !paymentId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca detalhes do pagamento
    const payResp = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${mpToken}` },
    });
    const payment = await payResp.json();

    if (!payResp.ok) {
      console.error("[mp-webhook] failed to fetch payment:", payment);
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: corsHeaders });
    }

    const status = payment?.status; // approved, pending, rejected, refunded, etc.
    const externalRef = payment?.external_reference as string | undefined;
    const metadata = payment?.metadata || {};
    const payerEmail = payment?.payer?.email;

    if (status !== "approved") {
      console.log("[mp-webhook] payment not approved, status:", status);
      return new Response(JSON.stringify({ ok: true, status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Pagamento aprovado: liberar acesso ============
    const productType = metadata.product_type as string | undefined;
    const productId = metadata.product_id as string | undefined;
    let userId = (metadata.user_id as string | undefined) || null;

    if (!productType || !productId || (productType !== "club" && !ACCESS_TABLE_MAP[productType])) {
      throw new Error(`Metadata inválido: type=${productType} id=${productId}`);
    }

    // Se não tinha user_id (visitante), tenta achar pelo email do pagador
    if (!userId && payerEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", payerEmail)
        .maybeSingle();
      userId = profile?.user_id || null;
    }

    if (!userId) {
      console.log("[mp-webhook] approved but no user_id (guest checkout). Email:", payerEmail);
      return new Response(JSON.stringify({ ok: true, pending_user: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (productType === "club") {
      const periodDays = Number(metadata.access_period_days) || 365;
      await grantClubAccess(supabase, userId, payment, String(paymentId), periodDays);

      await recordPurchase(supabase, {
        userId,
        productId: null,
        productName: periodDays >= 365 ? "Clube dos Drinkeros · Anual" : "Clube dos Drinkeros · Mensal",
        productType: "club",
        amountPaid: Number(payment?.transaction_amount || 0),
        currency: String(payment?.currency_id || "BRL").toUpperCase(),
        status: "approved",
        transactionId: String(paymentId),
        metadata: { period_days: periodDays },
      });

      return new Response(JSON.stringify({ ok: true, granted: true, club: true, period_days: periodDays }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { table, fk } = ACCESS_TABLE_MAP[productType];
    const { error: insertErr } = await supabase.from(table).upsert({
      user_id: userId,
      [fk]: productId,
      source: "mercadopago",
      mercadopago_payment_id: String(paymentId),
      amount: Number(payment?.transaction_amount || 0),
      currency: String(payment?.currency_id || "BRL").toUpperCase(),
      purchased_at: new Date().toISOString(),
    }, { onConflict: `user_id,${fk}` });

    if (insertErr) {
      console.error("[mp-webhook] failed to grant access:", insertErr);
      throw insertErr;
    }

    // Busca nome real do produto p/ Meta Pixel
    const productTableMap: Record<string, string> = {
      course: "courses", ebook: "ebooks", combo: "combos", package: "packages",
    };
    const { data: prodRow } = await supabase
      .from(productTableMap[productType])
      .select("name").eq("id", productId).maybeSingle();

    await recordPurchase(supabase, {
      userId,
      productId,
      productName: (prodRow as any)?.name || productType,
      productType,
      amountPaid: Number(payment?.transaction_amount || 0),
      currency: String(payment?.currency_id || "BRL").toUpperCase(),
      status: "approved",
      transactionId: String(paymentId),
      metadata: {},
    });

    console.log("[mp-webhook] access granted:", { userId, productType, productId, paymentId });

    return new Response(JSON.stringify({ ok: true, granted: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[mp-webhook]", err);
    // Sempre 200 para MP não reenviar infinito; já registramos no DB
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
