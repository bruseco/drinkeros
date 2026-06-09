// Cria assinatura recorrente (preapproval) do Clube no Mercado Pago
// usando o token do cartão gerado pelo Brick — checkout transparente, sem redirect.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

const PLANS: Record<string, { amount: number; frequency: number; reason: string }> = {
  "clube-anual": { amount: 47, frequency: 12, reason: "Clube dos Drinkeros · Anual" },
  clube:         { amount: 9.9, frequency: 1,  reason: "Clube dos Drinkeros · Mensal" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const body = await req.json().catch(() => ({}));
    const slug = (body?.slug as string) || "clube-anual";
    const plan = PLANS[slug] || PLANS["clube-anual"];
    const cardTokenId = body?.card_token_id as string | undefined;
    if (!cardTokenId) throw new Error("Token do cartão ausente");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Faça login para assinar");
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user?.email) throw new Error("Usuário sem email");

    // Desconto Jovem Bartender (≤24 anos): R$27 no clube-anual.
    let amount = plan.amount;
    let reason = plan.reason;
    if (slug === "clube-anual") {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: prof } = await admin
        .from("profiles")
        .select("birth_date")
        .eq("user_id", user.id)
        .maybeSingle();
      const bd = (prof as any)?.birth_date as string | null;
      if (bd) {
        const d = new Date(bd);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          let age = now.getFullYear() - d.getFullYear();
          const m = now.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
          if (age >= 14 && age <= 24) {
            amount = 27;
            reason = `${plan.reason} · Jovem Bartender`;
          }
        }
      }
    }

    const payerEmail = (body?.payer_email as string | undefined) || user.email;
    const externalRef = `club:${user.id}:${slug}:${Date.now()}`;

    const preapprovalBody: Record<string, unknown> = {
      reason,
      external_reference: externalRef,
      payer_email: payerEmail,
      card_token_id: cardTokenId,
      auto_recurring: {
        frequency: plan.frequency,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "BRL",
      },
      back_url: "https://drinkeros.com/clube?clube=success",
      status: "authorized",
    };

    const resp = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": externalRef,
      },
      body: JSON.stringify(preapprovalBody),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[create-mp-subscription] MP error:", data);
      throw new Error(data?.message || "Falha ao criar assinatura");
    }

    console.log("[create-mp-subscription] created:", { id: data.id, status: data.status });

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status, // "authorized" quando aprovado, "pending" caso contrário
        status_detail: data?.status_detail,
        next_payment_date: data?.next_payment_date,
        amount: plan.amount,
        currency: "BRL",
        product_name: plan.reason,
        product_id: slug,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-mp-subscription]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
