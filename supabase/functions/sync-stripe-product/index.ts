// Cria/atualiza Product e Price no Stripe a partir de um curso ou ebook,
// e salva os IDs nas tabelas correspondentes.
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Verifica admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) throw new Error("Forbidden");

    const { product_type, product_id } = await req.json();
    if (!["course", "ebook"].includes(product_type)) throw new Error("Invalid product_type");
    if (!product_id) throw new Error("Missing product_id");

    const table = product_type === "course" ? "courses" : "ebooks";
    const { data: row, error: rowErr } = await supabase
      .from(table)
      .select("id, name, description, price, cover_image_url, stripe_product_id, stripe_price_id")
      .eq("id", product_id)
      .single();
    if (rowErr || !row) throw new Error("Product not found");

    if (!row.price || Number(row.price) <= 0) {
      throw new Error("Defina um preço maior que zero antes de sincronizar com Stripe");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Cria ou atualiza Product
    let stripeProductId = (row as any).stripe_product_id as string | null;
    if (stripeProductId) {
      try {
        await stripe.products.update(stripeProductId, {
          name: row.name,
          description: row.description || undefined,
          images: row.cover_image_url ? [row.cover_image_url] : undefined,
          metadata: { product_type, product_id: row.id },
        });
      } catch (_) {
        stripeProductId = null;
      }
    }
    if (!stripeProductId) {
      const created = await stripe.products.create({
        name: row.name,
        description: row.description || undefined,
        images: row.cover_image_url ? [row.cover_image_url] : undefined,
        metadata: { product_type, product_id: row.id },
      });
      stripeProductId = created.id;
    }

    // Cria novo Price (Stripe não permite editar valor de Price existente).
    // Se já existir, arquiva o antigo.
    const newPrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: Math.round(Number(row.price) * 100),
      currency: "brl",
      metadata: { product_type, product_id: row.id },
    });

    const oldPriceId = (row as any).stripe_price_id as string | null;
    if (oldPriceId && oldPriceId !== newPrice.id) {
      try { await stripe.prices.update(oldPriceId, { active: false }); } catch (_) { /* ignore */ }
    }

    await supabase
      .from(table)
      .update({ stripe_product_id: stripeProductId, stripe_price_id: newPrice.id })
      .eq("id", row.id);

    return new Response(
      JSON.stringify({
        success: true,
        stripe_product_id: stripeProductId,
        stripe_price_id: newPrice.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[sync-stripe-product]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
