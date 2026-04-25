// Cria sessão de Stripe Checkout para um curso ou ebook.
// Funciona para usuários logados (vincula user_id) e visitantes (coleta email no Checkout).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const { product_type, slug } = await req.json();
    if (!["course", "ebook"].includes(product_type)) throw new Error("Invalid product_type");
    if (!slug) throw new Error("Missing slug");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const table = product_type === "course" ? "courses" : "ebooks";
    const { data: product, error: productErr } = await supabase
      .from(table)
      .select("id, name, slug, stripe_price_id, is_available_for_sale")
      .eq("slug", slug)
      .maybeSingle();
    if (productErr || !product) throw new Error("Produto não encontrado");
    if (!product.is_available_for_sale) throw new Error("Produto não está disponível para venda");
    if (!(product as any).stripe_price_id) {
      throw new Error("Produto ainda não foi sincronizado com Stripe");
    }

    // Tenta identificar usuário logado (opcional)
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supabaseAuth = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
        );
        const token = authHeader.replace("Bearer ", "");
        const { data } = await supabaseAuth.auth.getUser(token);
        if (data.user) {
          userId = data.user.id;
          userEmail = data.user.email ?? null;
        }
      } catch (_) { /* visitante */ }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId: string | undefined;
    if (userEmail) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      customerId = existing.data[0]?.id;
    }

    const origin = req.headers.get("origin") || "https://drinkeros.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      customer_email: customerId ? undefined : userEmail || undefined,
      client_reference_id: userId || undefined,
      line_items: [{ price: (product as any).stripe_price_id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/${product.slug}?checkout=success`,
      cancel_url: `${origin}/${product.slug}?checkout=cancel`,
      metadata: {
        product_type,
        product_id: product.id,
        product_slug: product.slug,
        user_id: userId || "",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-product-checkout]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
