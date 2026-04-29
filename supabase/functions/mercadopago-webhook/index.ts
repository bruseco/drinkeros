// Webhook do Mercado Pago: recebe notificações de pagamento, busca detalhes via API,
// registra evento e libera acesso ao produto (curso/ebook/combo/pacote) quando approved.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

async function grantClubAccess(supabase: any, userId: string, payment: any, paymentId: string) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

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
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // MP envia: { type: "payment", data: { id: "..." } } ou query ?topic=payment&id=...
    const topic = body?.type || body?.topic || url.searchParams.get("topic") || url.searchParams.get("type");
    const paymentId = body?.data?.id || url.searchParams.get("id") || url.searchParams.get("data.id");

    console.log("[mp-webhook] received:", { topic, paymentId, body });

    if (topic !== "payment" || !paymentId) {
      // Apenas ack — outros tópicos (merchant_order, etc.) ignorados por enquanto
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      await supabase.from("mercadopago_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: `Guest purchase awaiting account creation. Email: ${payerEmail}`,
      }).eq("id", eventRow!.id);
      return new Response(JSON.stringify({ ok: true, pending_user: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (productType === "club") {
      await grantClubAccess(supabase, userId, payment, String(paymentId));
      await supabase.from("mercadopago_events").update({
        processed: true,
        processed_at: new Date().toISOString(),
      }).eq("id", eventRow!.id);

      return new Response(JSON.stringify({ ok: true, granted: true, club: true }), {
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
      purchased_at: new Date().toISOString(),
    }, { onConflict: `user_id,${fk}` });

    if (insertErr) {
      console.error("[mp-webhook] failed to grant access:", insertErr);
      await supabase.from("mercadopago_events").update({
        error_message: `Grant access failed: ${insertErr.message}`,
      }).eq("id", eventRow!.id);
      throw insertErr;
    }

    await supabase.from("mercadopago_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
    }).eq("id", eventRow!.id);

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
