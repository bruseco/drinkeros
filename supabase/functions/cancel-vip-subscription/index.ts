import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;
    const userEmail = userData.user.email;

    // Busca pagamentos VIP do usuário para detectar provider
    const { data: payments } = await supabase
      .from("vip_payments")
      .select("id, metadata, stripe_subscription_id, stripe_customer_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const stripeSubId = payments?.find((p: any) => p.stripe_subscription_id)?.stripe_subscription_id as string | undefined;
    const stripeCustomerId = payments?.find((p: any) => p.stripe_customer_id)?.stripe_customer_id as string | undefined;
    const preapprovalId = payments?.find((p: any) => p.metadata?.mp_preapproval_id)?.metadata?.mp_preapproval_id as string | undefined;

    const cancelled: string[] = [];
    const errors: string[] = [];

    // === Stripe ===
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Coleta todas as subscriptions ativas do cliente (DB + lookup por email)
      const subIds = new Set<string>();
      if (stripeSubId) subIds.add(stripeSubId);

      let customerIds: string[] = [];
      if (stripeCustomerId) customerIds.push(stripeCustomerId);
      if (userEmail) {
        try {
          const customers = await stripe.customers.list({ email: userEmail, limit: 5 });
          for (const c of customers.data) if (!customerIds.includes(c.id)) customerIds.push(c.id);
        } catch (e: any) {
          console.warn("[cancel-vip-subscription] customers.list failed:", e?.message);
        }
      }

      for (const cid of customerIds) {
        try {
          const subs = await stripe.subscriptions.list({ customer: cid, status: "all", limit: 20 });
          for (const s of subs.data) {
            if (s.status === "active" || s.status === "trialing" || s.status === "past_due") {
              subIds.add(s.id);
            }
          }
        } catch (e: any) {
          console.warn("[cancel-vip-subscription] subscriptions.list failed:", e?.message);
        }
      }

      for (const subId of subIds) {
        try {
          // cancel_at_period_end: true → sem estorno, mantém acesso até o fim do período pago,
          // próxima cobrança NÃO acontece.
          const updated = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
          console.log("[cancel-vip-subscription] stripe sub set to cancel_at_period_end:", subId, updated.status);
          cancelled.push(`stripe:${subId}`);
        } catch (e: any) {
          const msg = e?.message || String(e);
          // Se já está cancelada, segue
          if (/No such subscription|canceled/i.test(msg)) {
            console.log("[cancel-vip-subscription] stripe sub already canceled:", subId);
          } else {
            console.error("[cancel-vip-subscription] stripe cancel failed:", subId, msg);
            errors.push(`stripe ${subId}: ${msg}`);
          }
        }
      }
    }

    // === Mercado Pago ===
    if (preapprovalId) {
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpToken) {
        errors.push("MERCADOPAGO_ACCESS_TOKEN not configured");
      } else {
        try {
          const resp = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${mpToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "cancelled" }),
          });
          const data = await resp.json();
          if (!resp.ok) {
            errors.push(`mp ${preapprovalId}: ${data?.message || resp.status}`);
          } else {
            cancelled.push(`mercadopago:${preapprovalId}`);
          }
        } catch (e: any) {
          errors.push(`mp ${preapprovalId}: ${e?.message ?? e}`);
        }
      }
    }

    if (cancelled.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_subscription",
          message:
            "Nenhuma assinatura recorrente ativa encontrada. Se foi pago manualmente ou por outro canal, fale com o suporte pelo WhatsApp.",
          errors,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancelled,
        errors,
        message:
          "Assinatura cancelada. Você mantém o acesso até o fim do período já pago e não haverá próxima cobrança.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cancel-vip-subscription]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
