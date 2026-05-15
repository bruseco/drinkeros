// Creates a Stripe Checkout Session for the Clube dos Drinkeros.
// - method=card  -> mode=subscription (recurring yearly, silent renewal)
// - method=pix   -> mode=payment      (one-time, grants 12 months of access)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_CARD = "price_1TOEs9GlXZFgg9244Xs7Bloe"; // R$ 69 / ano (recurring) — prod_UMyp07z2Rx5wUF
const PRICE_PIX = "price_1TT4AHGlXZFgg924s0NVsKIV";  // R$ 69 (one-time, live) — prod_UMyp07z2Rx5wUF

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user?.email) throw new Error("Not authenticated");
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const method: "card" | "pix" = body?.method === "pix" ? "pix" : "card";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const existing = await stripe.customers.list({ email: user.email!, limit: 1 });
    const customerId = existing.data[0]?.id;

    const origin = req.headers.get("origin") || "https://drinkeros.com";

    const isCard = method === "card";

    const session = await stripe.checkout.sessions.create({
      mode: isCard ? "subscription" : "payment",
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      client_reference_id: user.id,
      line_items: [{ price: isCard ? PRICE_CARD : PRICE_PIX, quantity: 1 }],
      payment_method_types: isCard ? ["card"] : ["pix"],
      locale: "pt-BR",
      success_url: `${origin}/clube?clube=success`,
      cancel_url: `${origin}/clube?clube=cancel`,
      metadata: {
        user_id: user.id,
        plan_kind: isCard ? "club_card_subscription" : "club_pix_annual",
      },
      ...(isCard
        ? {
            subscription_data: {
              metadata: {
                user_id: user.id,
                plan_kind: "club_card_subscription",
              },
            },
          }
        : {
            payment_intent_data: {
              metadata: {
                user_id: user.id,
                plan_kind: "club_pix_annual",
              },
            },
          }),
    });

    // Recupera amount real do price para tracking dinâmico (sem hardcode no front)
    let amount = 0;
    let currency = "BRL";
    try {
      const priceObj = await stripe.prices.retrieve(isCard ? PRICE_CARD : PRICE_PIX);
      amount = (priceObj.unit_amount ?? 0) / 100;
      currency = (priceObj.currency || "brl").toUpperCase();
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        amount,
        currency,
        product_name: isCard ? "Clube dos Drinkeros · Anual (Cartão)" : "Clube dos Drinkeros · Anual (Pix)",
        price_id: isCard ? PRICE_CARD : PRICE_PIX,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-club-checkout]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
