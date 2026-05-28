// Creates a Stripe Checkout Session for the Clube dos Drinkeros.
// - method=card  -> mode=subscription (recurring yearly, silent renewal)
// - method=pix   -> mode=payment      (one-time, grants 12 months of access)
//
// Offers (sempre cobra a partir de R$197 + cupom para que o valor exibido na
// landing seja EXATAMENTE o valor cobrado no Stripe):
// - offer=intro -> R$197 + cupom CLUBE_INTRO_100 (R$100 off) = R$ 97
// - offer=exit  -> R$197 + cupom CLUBE_EXIT_128  (R$128 off) = R$ 69
// - offer=full  -> R$197 sem cupom
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prices R$197 (cartão recorrente / Pix avulso) — produto prod_UMyp07z2Rx5wUF
const PRICE_CARD_197 = "price_1TbyKYGlXZFgg9244vr2jrTS";
const PRICE_PIX_197 = "price_1TbyL1GlXZFgg924wxKo7wVc";

// Coupons (duration: forever) — desconto persiste em todas as renovações anuais
const COUPON_INTRO_100 = "xEg5vViJ"; // R$100 off → R$97 forever
const COUPON_EXIT_128 = "Hy11JuxP";  // R$128 off → R$69 forever

type Offer = "intro" | "exit" | "full";

function resolveOffer(input: unknown): Offer {
  return input === "exit" || input === "full" ? input : "intro";
}

function couponFor(offer: Offer): string | null {
  if (offer === "intro") return COUPON_INTRO_100;
  if (offer === "exit") return COUPON_EXIT_128;
  return null;
}

function expectedAmount(offer: Offer): number {
  if (offer === "intro") return 97;
  if (offer === "exit") return 69;
  return 197;
}

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
    const offer: Offer = resolveOffer(body?.offer);
    const coupon = couponFor(offer);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const existing = await stripe.customers.list({ email: user.email!, limit: 1 });
    const customerId = existing.data[0]?.id;

    const origin = req.headers.get("origin") || "https://drinkeros.com";

    const isCard = method === "card";
    const priceId = isCard ? PRICE_CARD_197 : PRICE_PIX_197;

    const sessionParams: any = {
      mode: isCard ? "subscription" : "payment",
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: isCard ? ["card"] : ["pix"],
      locale: "pt-BR",
      success_url: `${origin}/clube-b?clube=success`,
      cancel_url: `${origin}/clube-b?clube=cancel`,
      metadata: {
        user_id: user.id,
        plan_kind: isCard ? "club_card_subscription" : "club_pix_annual",
        offer,
      },
    };

    if (coupon) {
      sessionParams.discounts = [{ coupon }];
    }

    if (isCard) {
      sessionParams.subscription_data = {
        metadata: {
          user_id: user.id,
          plan_kind: "club_card_subscription",
          offer,
        },
      };
    } else {
      sessionParams.payment_intent_data = {
        metadata: {
          user_id: user.id,
          plan_kind: "club_pix_annual",
          offer,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    const amount = expectedAmount(offer);
    const currency = "BRL";

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
        amount,
        currency,
        offer,
        product_name: `Clube dos Drinkeros · Anual (${isCard ? "Cartão" : "Pix"}) · R$${amount}`,
        price_id: priceId,
        coupon,
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
