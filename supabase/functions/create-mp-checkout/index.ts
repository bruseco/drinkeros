// Cria preferência de Checkout Pro do Mercado Pago para curso, ebook, combo ou pacote.
// Suporta usuários logados (vincula user_id) e visitantes (coleta email no MP).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

type ProductType = "course" | "ebook" | "combo" | "package";

const TABLE_MAP: Record<ProductType, string> = {
  course: "courses",
  ebook: "ebooks",
  combo: "combos",
  package: "packages",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const { product_type, slug } = await req.json();
    if (!["course", "ebook", "combo", "package"].includes(product_type)) {
      throw new Error("Invalid product_type");
    }
    if (!slug) throw new Error("Missing slug");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const table = TABLE_MAP[product_type as ProductType];
    const { data: product, error: productErr } = await supabase
      .from(table)
      .select("id, name, slug, price, cover_image_url, description")
      .eq("slug", slug)
      .maybeSingle();
    if (productErr || !product) throw new Error("Produto não encontrado");
    if (!product.price || Number(product.price) <= 0) {
      throw new Error("Produto sem preço configurado");
    }

    // Identifica usuário logado (opcional) e checa VIP
    let userId: string | null = null;
    let userEmail: string | null = null;
    let isVip = false;
    let introStartedAt: string | null = null;
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
          const { data: planV2 } = await supabase.rpc("get_user_plan_v2", { _user_id: userId });
          isVip = planV2 === "socio" || planV2 === "vitalicio";
          if (isVip) {
            const { data: planRow } = await supabase
              .from("user_plans").select("discount_intro_started_at").eq("user_id", userId).maybeSingle();
            introStartedAt = (planRow as any)?.discount_intro_started_at ?? null;
          }
        }
      } catch (_) { /* visitante */ }
    }

    // Desconto escalonado (Sócio + Vitalício, sincroniza com src/lib/vipDiscount.ts)
    const VIP_INTRO_PERCENT = 80;
    const VIP_BASE_PERCENT = 50;
    const VIP_INTRO_WINDOW_DAYS = 7;
    let vipPercent = 0;
    if (isVip) {
      if (!introStartedAt) vipPercent = VIP_INTRO_PERCENT;
      else {
        const days = (Date.now() - new Date(introStartedAt).getTime()) / 86400000;
        vipPercent = days <= VIP_INTRO_WINDOW_DAYS ? VIP_INTRO_PERCENT : VIP_BASE_PERCENT;
      }
    }
    const applyDiscount = vipPercent > 0;
    const basePrice = Number(product.price);
    // Preço VIP fixo por produto (sincronizado com src/lib/vipDiscount.ts)
    const VIP_FIXED_PRICE_BY_SLUG: Record<string, number> = { "classicos-destilados": 197 };
    const vipFixed = VIP_FIXED_PRICE_BY_SLUG[product.slug];
    const finalPrice = applyDiscount
      ? (vipFixed !== undefined
        ? Math.min(vipFixed, basePrice)
        : Math.round(basePrice * (1 - vipPercent / 100) * 100) / 100)
      : basePrice;

    const origin = req.headers.get("origin") || "https://drinkeros.com";
    const externalRef = `${product_type}:${product.id}:${userId || "guest"}:${Date.now()}`;

    const preferenceBody = {
      items: [
        {
          id: product.id,
          title: applyDiscount
            ? `${product.name} (Sócio do Clube -${vipPercent}%)`
            : product.name,
          description: product.description ?? undefined,
          picture_url: product.cover_image_url ?? undefined,
          quantity: 1,
          currency_id: "BRL",
          unit_price: finalPrice,
        },
      ],
      payer: userEmail ? { email: userEmail } : undefined,
      back_urls: {
        success: `${origin}/${product.slug}?checkout=success`,
        failure: `${origin}/${product.slug}?checkout=cancel`,
        pending: `${origin}/${product.slug}?checkout=pending`,
      },
      auto_return: "approved",
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DRINKEROS",
      metadata: {
        product_type,
        product_id: product.id,
        product_slug: product.slug,
        user_id: userId || "",
        vip_discount_applied: applyDiscount ? "true" : "false",
        vip_discount_percent: applyDiscount ? String(vipPercent) : "0",
        buyer_email: userEmail || "",
      },
      // Permite até 12x no cartão (juros do emissor)
      payment_methods: {
        installments: 12,
      },
    };

    const mpResp = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      console.error("[create-mp-checkout] MP error:", mpData);
      throw new Error(mpData?.message || "Falha ao criar preferência no Mercado Pago");
    }

    console.log("[create-mp-checkout] preference created:", {
      id: mpData.id,
      external_reference: externalRef,
      init_point: mpData.init_point,
    });

    return new Response(
      JSON.stringify({
        url: mpData.init_point,
        sandbox_url: mpData.sandbox_init_point,
        preference_id: mpData.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-mp-checkout]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
