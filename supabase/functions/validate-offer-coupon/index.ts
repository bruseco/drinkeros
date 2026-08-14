// Valida o token do cupom enviado por e-mail e devolve o preço final da oferta.
// Público (sem JWT). Nunca confia em preço vindo do cliente.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OFFERS } from "../_shared/offerLeads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let token = "";
    if (req.method === "GET") {
      token = new URL(req.url).searchParams.get("token") || "";
    } else {
      const body = await req.json().catch(() => ({}));
      token = String(body?.token || "");
    }
    token = token.trim();
    if (!token || token.length > 128) return json({ valid: false });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: lead } = await supabase
      .from("landing_offer_leads")
      .select("page_key, name, email, email_sent_at, token_expires_at, redeemed_at")
      .eq("discount_token", token)
      .maybeSingle();

    const l = lead as any;
    if (!l) return json({ valid: false });

    const offer = OFFERS[l.page_key];
    if (!offer) return json({ valid: false });
    if (!l.email_sent_at) return json({ valid: false });
    if (l.redeemed_at) return json({ valid: false });
    if (l.token_expires_at && new Date(l.token_expires_at).getTime() < Date.now()) {
      return json({ valid: false });
    }

    return json({
      valid: true,
      page_key: l.page_key,
      product_slug: offer.productSlug,
      product_type: offer.productType,
      price: offer.couponPrice,
      previous_price: offer.revealPrice,
      name: l.name,
      email: l.email,
      expires_at: l.token_expires_at,
    });
  } catch (err) {
    console.error("[validate-offer-coupon]", err);
    return json({ valid: false }, 500);
  }
});
