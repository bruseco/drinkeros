import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Pega assinatura ativa mais recente
    const { data: payments } = await supabase
      .from("vip_payments")
      .select("stripe_subscription_id, metadata")
      .eq("user_id", userId)
      .not("stripe_subscription_id", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1);

    const subscriptionId = payments?.[0]?.stripe_subscription_id;

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_subscription",
          message:
            "Nenhuma assinatura recorrente encontrada. Se foi pago manualmente ou via PIX/boleto, fale com o suporte pelo WhatsApp.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Cancela ao fim do período — usuário mantém acesso até expires_at
    const sub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    const cancelAt = sub.cancel_at
      ? new Date(sub.cancel_at * 1000).toISOString()
      : sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    return new Response(
      JSON.stringify({
        success: true,
        cancel_at: cancelAt,
        message: "Assinatura cancelada. Você mantém acesso até o fim do período já pago.",
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
