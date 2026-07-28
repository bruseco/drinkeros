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

async function invokeWebhookFallback(paymentId: unknown) {
  if (!paymentId) return;
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-mp-sync": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      },
      body: JSON.stringify({ type: "payment", data: { id: String(paymentId) }, source: "create-mp-payment-fallback" }),
    });
    if (!resp.ok) console.warn("[create-mp-payment] webhook fallback non-2xx", resp.status);
  } catch (e) {
    console.warn("[create-mp-payment] webhook fallback failed", (e as Error).message);
  }
}

const CLUB_PRODUCTS: Record<string, { id: string; name: string; slug: string; price: number; cover_image_url: null; description: string; period_days: number }> = {
  "clube-anual": {
    id: "club",
    name: "Clube dos Drinkeros · Anual",
    slug: "clube-anual",
    price: 47,
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
      fiscal, // dados fiscais coletados no checkout (CPF + endereço) — obrigatórios para NFS-e
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

    if (product_type === "club" && !userId) {
      throw new Error("Faça login para assinar o Clube dos Drinkeros");
    }

    // Desconto Jovem Bartender (≤24 anos): R$27 no clube-anual.
    let youthDiscount = false;
    if (product_type === "club" && product.slug === "clube-anual" && userId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("birth_date")
        .eq("user_id", userId)
        .maybeSingle();
      const bd = (prof as any)?.birth_date as string | null;
      if (bd) {
        const d = new Date(bd);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          let age = now.getFullYear() - d.getFullYear();
          const m = now.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
          if (age >= 14 && age <= 24) youthDiscount = true;
        }
      }
    }

    // Desconto escalonado (Sócio + Vitalício, sincroniza com src/lib/vipDiscount.ts)
    const VIP_INTRO_PERCENT = 80;
    const VIP_BASE_PERCENT = 50;
    const VIP_INTRO_WINDOW_DAYS = 7;
    let vipPercent = 0;
    if (isVip && product_type !== "club") {
      if (!introStartedAt) vipPercent = VIP_INTRO_PERCENT;
      else {
        const days = (Date.now() - new Date(introStartedAt).getTime()) / 86400000;
        vipPercent = days <= VIP_INTRO_WINDOW_DAYS ? VIP_INTRO_PERCENT : VIP_BASE_PERCENT;
      }
    }
    const applyDiscount = vipPercent > 0;
    const basePrice = Number(product.price);
    const finalPrice = product_type === "club"
      ? (youthDiscount ? 27 : basePrice)
      : applyDiscount
      ? Math.round(basePrice * (1 - vipPercent / 100) * 100) / 100
      : basePrice;

    const externalRef = `${product_type}:${product.id}:${userId || "guest"}:${Date.now()}`;
    const payerEmail = formData?.payer?.email || userEmail || "comprador@drinkeros.com";

    // Monta body do pagamento conforme método
    const isPix = formData.payment_method_id === "pix";
    const paymentBody: Record<string, unknown> = {
      transaction_amount: finalPrice,
      description: youthDiscount
        ? `${product.name} (Jovem Bartender)`
        : applyDiscount
        ? `${product.name} (Sócio do Clube -${vipPercent}%)`
        : product.name,
      payment_method_id: formData.payment_method_id,
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
        access_period_days: product_type === "club" ? String(clubPeriodDays) : "",
        youth_discount: youthDiscount ? "true" : "false",
        buyer_email: payerEmail,
        // CPF informado no Brick do MP — persistido no perfil pelo webhook para a NFS-e.
        buyer_cpf: String(formData?.payer?.identification?.number || "").replace(/\D/g, ""),
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

    // Rede de segurança: cartão aprovado volta na hora e às vezes o webhook do MP não chega.
    // Chamamos o mesmo processador de webhook de forma interna/idempotente para registrar venda e liberar acesso.
    if (mpData?.status === "approved") {
      await invokeWebhookFallback(mpData.id);
    }

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
        product_id: product.id,
        product_name: product.name,
        amount: finalPrice,
        currency: "BRL",
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
