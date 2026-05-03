// Checkout transparente: cria pagamento direto via API do Mercado Pago (Cartão ou Pix)
// usando o token gerado pelo Payment Brick no frontend.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";
type ProductType = "course" | "ebook" | "combo" | "package" | "club";
const TABLE_MAP: Record<Exclude<ProductType, "club">, string> = {
  course: "courses",
  ebook: "ebooks",
  combo: "combos",
  package: "packages",
};

const CLUB_PRODUCTS: Record<string, { id: string; name: string; slug: string; price: number; cover_image_url: null; description: string; period_days: number }> = {
  "clube-anual": {
    id: "club",
    name: "Clube dos Drinkeros · Anual",
    slug: "clube-anual",
    price: 69,
    cover_image_url: null,
    description: "Acesso por 12 meses ao Clube.",
    period_days: 365,
  },
  clube: {
    id: "club",
    name: "Clube dos Drinkeros · Mensal",
    slug: "clube",
    price: 9.9,
    cover_image_url: null,
    description: "Acesso por 30 dias ao Clube.",
    period_days: 30,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const body = await req.json();
    const {
      product_type,
      slug,
      formData, // vindo do Brick: { token, payment_method_id, issuer_id, installments, payer:{email, identification}, transaction_amount }
    } = body || {};

    if (!["course", "ebook", "combo", "package", "club"].includes(product_type)) {
      throw new Error("Invalid product_type");
    }
    if (!slug) throw new Error("Missing slug");
    if (!formData || !formData.payment_method_id) throw new Error("Missing formData");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let product: any = null;
    let clubPeriodDays = 0;
    if (product_type === "club") {
      const clubProd = CLUB_PRODUCTS[slug] || CLUB_PRODUCTS["clube-anual"];
      product = clubProd;
      clubPeriodDays = clubProd.period_days;
    } else {
      const table = TABLE_MAP[product_type as Exclude<ProductType, "club">];
      const { data: productData, error: productErr } = await supabase
        .from(table)
        .select("id, name, slug, price, cover_image_url, description")
        .eq("slug", slug)
        .maybeSingle();
      if (productErr || !productData) throw new Error("Produto não encontrado");
      product = productData;
    }
    if (!product.price || Number(product.price) <= 0) {
      throw new Error("Produto sem preço configurado");
    }

    // Identifica usuário logado e checa VIP
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
          const { data: planData } = await supabase.rpc("get_user_plan", { _user_id: userId });
          isVip = planData === "vip";
        }
      } catch (_) { /* visitante */ }
    }

    if (product_type === "club" && !userId) {
      throw new Error("Faça login para assinar o Clube dos Drinkeros");
    }

    const VIP_DISCOUNT_PERCENT = 80;
    const basePrice = Number(product.price);
    const finalPrice = product_type === "club"
      ? basePrice
      : isVip
      ? Math.round(basePrice * (1 - VIP_DISCOUNT_PERCENT / 100) * 100) / 100
      : basePrice;

    const externalRef = `${product_type}:${product.id}:${userId || "guest"}:${Date.now()}`;
    const payerEmail = formData?.payer?.email || userEmail || "comprador@drinkeros.com";

    // Monta body do pagamento conforme método
    const isPix = formData.payment_method_id === "pix";
    const paymentBody: Record<string, unknown> = {
      transaction_amount: finalPrice,
      description: isVip ? `${product.name} (Sócio do Clube -${VIP_DISCOUNT_PERCENT}%)` : product.name,
      payment_method_id: formData.payment_method_id,
      external_reference: externalRef,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DRINKEROS",
      metadata: {
        product_type,
        product_id: product.id,
        product_slug: product.slug,
        user_id: userId || "",
        vip_discount_applied: isVip ? "true" : "false",
        vip_discount_percent: isVip ? String(VIP_DISCOUNT_PERCENT) : "0",
        access_period_days: product_type === "club" ? "365" : "",
      },
      payer: {
        email: payerEmail,
        ...(formData?.payer?.identification ? { identification: formData.payer.identification } : {}),
      },
    };

    if (!isPix) {
      paymentBody.token = formData.token;
      paymentBody.installments = formData.installments || 1;
      if (formData.issuer_id) paymentBody.issuer_id = formData.issuer_id;
    }

    const idempotencyKey = `${externalRef}:${Math.random().toString(36).slice(2, 10)}`;

    const mpResp = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) {
      console.error("[create-mp-payment] MP error:", mpData);
      throw new Error(mpData?.message || "Falha ao processar pagamento");
    }

    console.log("[create-mp-payment] payment created:", {
      id: mpData.id,
      status: mpData.status,
      method: mpData.payment_method_id,
      external_reference: externalRef,
    });

    // Para Pix retorna o QR code; para cartão retorna status
    const pixData = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
        payment_method_id: mpData.payment_method_id,
      installments: mpData.installments,
        product_slug: product.slug,
        pix: pixData ? {
          qr_code: pixData.qr_code,
          qr_code_base64: pixData.qr_code_base64,
          ticket_url: pixData.ticket_url,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-mp-payment]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
