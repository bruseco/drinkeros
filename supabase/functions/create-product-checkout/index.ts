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
    // ebooks não possui a coluna is_available_for_sale; só selecionamos quando aplicável
    const baseCols = "id, name, slug, price, stripe_price_id, stripe_product_id, cover_image_url, description";
    const selectCols = product_type === "course" ? `${baseCols}, is_available_for_sale` : baseCols;
    const { data: product, error: productErr } = await supabase
      .from(table)
      .select(selectCols)
      .eq("slug", slug)
      .maybeSingle();
    if (productErr || !product) throw new Error("Produto não encontrado");
    if (product_type === "course" && !(product as any).is_available_for_sale) {
      throw new Error("Produto não está disponível para venda");
    }
    if (!(product as any).price || Number((product as any).price) <= 0) {
      throw new Error("Produto sem preço configurado");
    }

    // Tenta identificar usuário logado (opcional)
    let userId: string | null = null;
    let userEmail: string | null = null;
    let isVip = false;
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
          // Verifica se é VIP via função SECURITY DEFINER
          const { data: planData } = await supabase.rpc("get_user_plan", { _user_id: userId });
          isVip = planData === "vip";
        }
      } catch (_) { /* visitante */ }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Sincroniza produto/preço com Stripe sob demanda (ex.: ebooks sem stripe_price_id)
    if (!(product as any).stripe_price_id) {
      let stripeProductId = (product as any).stripe_product_id as string | null;
      if (!stripeProductId) {
        const created = await stripe.products.create({
          name: (product as any).name,
          description: (product as any).description ?? undefined,
          images: (product as any).cover_image_url ? [(product as any).cover_image_url] : undefined,
          metadata: { source_product_id: (product as any).id, source_table: table },
        });
        stripeProductId = created.id;
      }
      const priceObj = await stripe.prices.create({
        product: stripeProductId!,
        currency: "brl",
        unit_amount: Math.round(Number((product as any).price) * 100),
      });
      await supabase.from(table).update({
        stripe_product_id: stripeProductId,
        stripe_price_id: priceObj.id,
      }).eq("id", (product as any).id);
      (product as any).stripe_product_id = stripeProductId;
      (product as any).stripe_price_id = priceObj.id;
    }

    let customerId: string | undefined;
    if (userEmail) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      customerId = existing.data[0]?.id;
    }

    const origin = req.headers.get("origin") || "https://drinkeros.com";

    // Regra universal: assinantes VIP recebem 80% OFF (cursos e ebooks).
    // Mantém sincronia com src/lib/vipDiscount.ts.
    const VIP_DISCOUNT_PERCENT = 80;
    const basePrice = Number((product as any).price ?? 0);
    const applyDiscount = isVip && basePrice > 0;
    const discountedAmount = applyDiscount
      ? Math.round(basePrice * (1 - VIP_DISCOUNT_PERCENT / 100) * 100)
      : null;

    const lineItem = applyDiscount
      ? {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: discountedAmount!,
            product_data: {
              name: `${(product as any).name} (Sócio do Clube -${VIP_DISCOUNT_PERCENT}%)`,
              description: (product as any).description ?? undefined,
              images: (product as any).cover_image_url ? [(product as any).cover_image_url] : undefined,
              metadata: { source_product_id: (product as any).id },
            },
          },
        }
      : { price: (product as any).stripe_price_id, quantity: 1 };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      customer_email: customerId ? undefined : userEmail || undefined,
      client_reference_id: userId || undefined,
      line_items: [lineItem as any],
      allow_promotion_codes: !applyDiscount, // evita stack de cupom + desconto VIP
      // Parcelamento com juros do emissor (cliente paga juros, loja recebe à vista)
      // Requer ativação manual: Stripe Dashboard → Settings → Payments → Cards → Installments (Brazil)
      payment_method_types: ["card"],
      payment_method_options: {
        card: {
          installments: { enabled: true },
        },
      },
      success_url: `${origin}/${product.slug}?checkout=success`,
      cancel_url: `${origin}/${product.slug}?checkout=cancel`,
      metadata: {
        product_type,
        product_id: product.id,
        product_slug: product.slug,
        user_id: userId || "",
        vip_discount_applied: applyDiscount ? "true" : "false",
        vip_discount_percent: applyDiscount ? String(VIP_DISCOUNT_PERCENT) : "0",
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
