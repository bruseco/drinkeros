// Oferta pós-compra do RAND: "Drinkeros Xperience + Workshop Além dos Clássicos" por R$97.
// Ações:
//  - create  { source_payment_id }            → valida compra RAND aprovada/recente no MP, devolve referência opaca
//  - get     { ref }                          → estado da oferta (sem PII além do e-mail do próprio comprador)
//  - track   { ref, event: view|accept|decline }
//  - pay     { ref, formData }                → 2º pagamento MP (novo token do Brick), preço validado no servidor
//  - status  { ref }                          → consulta o 2º pagamento (Pix) e marca como pago
// Cartão salvo / one-click: atrás de flag desligada (ONE_CLICK_ENABLED=false). Nunca guardamos PAN/CVV.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MP_API = "https://api.mercadopago.com";
const OFFER_KEY = "rand-xperience-workshop";
const SOURCE_SLUG = "rand";
const UPSELL_SLUG = "xperience-workshop-upsell";
const UPSELL_PRICE = 97;
const RECENT_HOURS = 24;
const MAX_CHECKOUT_ATTEMPTS = 5;
export const ONE_CLICK_ENABLED = false;

const UUID_RE = /^[0-9a-f-]{36}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) return json({ error: "Gateway não configurado" }, 500);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    const mpGet = async (id: string) => {
      const r = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      return r.ok ? await r.json() : null;
    };

    const { data: upsell } = await db.from("combos")
      .select("id, name, slug, price, cover_image_url").eq("slug", UPSELL_SLUG).maybeSingle();
    if (!upsell) return json({ error: "Oferta indisponível" }, 404);
    const price = Math.min(UPSELL_PRICE, Number(upsell.price) || UPSELL_PRICE);

    const ownsBoth = async (userId: string | null) => {
      if (!userId) return false;
      const { data: cc } = await db.from("combo_courses").select("course_id").eq("combo_id", upsell.id);
      const ids = (cc || []).map((r: any) => r.course_id);
      if (!ids.length) return false;
      const { data: uc } = await db.from("user_courses").select("course_id, expires_at")
        .eq("user_id", userId).in("course_id", ids);
      const active = new Set((uc || []).filter((r: any) => !r.expires_at || new Date(r.expires_at) > new Date())
        .map((r: any) => r.course_id));
      return ids.every((id) => active.has(id));
    };

    const userIdByEmail = async (email: string) => {
      const { data } = await db.from("profiles").select("user_id").eq("email", email).maybeSingle();
      return (data as any)?.user_id ?? null;
    };

    // ---------- create ----------
    if (action === "create") {
      const pid = String(body?.source_payment_id || "").trim();
      if (!/^\d{5,20}$/.test(pid)) return json({ error: "Pagamento inválido" }, 400);

      const { data: existing } = await db.from("post_purchase_offers").select("id")
        .eq("offer_key", OFFER_KEY).eq("source_payment_id", pid).maybeSingle();
      if (existing) return json({ ref: existing.id });

      const p = await mpGet(pid);
      if (!p || !["approved", "authorized"].includes(String(p.status))) {
        return json({ error: "Pagamento não aprovado", code: "not_eligible" }, 409);
      }
      const md = p.metadata || {};
      if (String(md.product_slug) !== SOURCE_SLUG) return json({ error: "Não elegível", code: "not_eligible" }, 409);
      const created = new Date(p.date_approved || p.date_created).getTime();
      if (!created || Date.now() - created > RECENT_HOURS * 3600_000) {
        return json({ error: "Oferta expirada", code: "expired" }, 409);
      }
      const email = String(md.buyer_email || p.payer?.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email === "comprador@drinkeros.com") {
        return json({ error: "Não elegível", code: "not_eligible" }, 409);
      }
      const { data: ins, error } = await db.from("post_purchase_offers").upsert({
        offer_key: OFFER_KEY,
        source_payment_id: pid,
        source_user_id: md.user_id || null,
        buyer_email: email,
        buyer_name: String(md.buyer_name || "").slice(0, 120) || null,
        buyer_cpf: String(md.buyer_cpf || p.payer?.identification?.number || "").replace(/\D/g, "") || null,
      }, { onConflict: "offer_key,source_payment_id" }).select("id").single();
      if (error) throw error;
      return json({ ref: ins.id });
    }

    // Demais ações exigem referência válida
    const ref = String(body?.ref || "");
    if (!UUID_RE.test(ref)) return json({ error: "Referência inválida" }, 400);
    const { data: offer } = await db.from("post_purchase_offers").select("*")
      .eq("id", ref).eq("offer_key", OFFER_KEY).maybeSingle();
    if (!offer) return json({ error: "Oferta não encontrada" }, 404);
    const o = offer as any;
    const expired = new Date(o.expires_at).getTime() < Date.now();
    const buyerUserId = o.source_user_id || (await userIdByEmail(o.buyer_email));

    const baseState = async () => ({
      status: o.status,
      expired,
      already_owned: o.status !== "paid" && (await ownsBoth(buyerUserId)),
      is_guest: !o.source_user_id,
      source_payment_id: o.source_payment_id,
      email: o.buyer_email,
      first_name: String(o.buyer_name || "").split(" ")[0] || null,
      has_cpf: !!o.buyer_cpf,
      product: { id: upsell.id, name: upsell.name, slug: upsell.slug, cover_image_url: upsell.cover_image_url },
      price,
      one_click_available: ONE_CLICK_ENABLED,
    });

    const patch = async (fields: Record<string, unknown>) => {
      await db.from("post_purchase_offers").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", ref);
      Object.assign(o, fields);
    };

    if (action === "get") return json(await baseState());

    if (action === "track") {
      const ev = String(body?.event || "");
      const now = new Date().toISOString();
      if (ev === "view" && !o.viewed_at) await patch({ viewed_at: now });
      if (ev === "accept" && !o.accepted_at) await patch({ accepted_at: now, status: o.status === "offered" ? "accepted" : o.status });
      if (ev === "decline" && !o.declined_at && o.status !== "paid") await patch({ declined_at: now, status: "declined" });
      return json({ ok: true });
    }

    const markPaidIfApproved = async (payment: any) => {
      if (payment?.status === "approved" && o.status !== "paid") {
        await patch({ status: "paid", paid_at: new Date().toISOString(), amount: Number(payment.transaction_amount) || price });
      }
    };

    if (action === "status") {
      if (o.status !== "paid" && o.upsell_payment_id) {
        const p = await mpGet(o.upsell_payment_id);
        await markPaidIfApproved(p);
      }
      return json(await baseState());
    }

    if (action === "pay") {
      if (o.status === "paid") return json({ error: "Oferta já utilizada", code: "already_paid" }, 409);
      if (o.status === "declined") return json({ error: "Oferta recusada", code: "declined" }, 409);
      if (expired) return json({ error: "Oferta expirada", code: "expired" }, 409);
      if (o.checkout_attempts >= MAX_CHECKOUT_ATTEMPTS) return json({ error: "Limite de tentativas atingido", code: "limit" }, 429);
      if (await ownsBoth(buyerUserId)) return json({ error: "Você já possui estes cursos", code: "already_owned" }, 409);

      const formData = body?.formData || {};
      const method = String(formData.payment_method_id || "");
      if (!method) return json({ error: "Dados do pagamento ausentes" }, 400);
      const isPix = method === "pix";
      if (!isPix && !formData.token) return json({ error: "Cartão inválido" }, 400);

      const cpf = String(formData?.payer?.identification?.number || o.buyer_cpf || "").replace(/\D/g, "");
      const paymentBody: Record<string, unknown> = {
        transaction_amount: price,
        description: upsell.name,
        payment_method_id: method,
        external_reference: `combo:${upsell.id}:${buyerUserId || "guest"}:${Date.now()}`,
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
        statement_descriptor: "DRINKEROS",
        metadata: {
          product_type: "combo",
          product_id: upsell.id,
          product_slug: upsell.slug,
          user_id: buyerUserId || "",
          buyer_email: o.buyer_email,
          buyer_name: o.buyer_name || "",
          buyer_cpf: cpf,
          upsell_offer_id: o.id,
          upsell_source_payment_id: o.source_payment_id,
        },
        payer: {
          email: o.buyer_email,
          ...(cpf.length === 11 ? { identification: { type: "CPF", number: cpf } } : {}),
        },
      };
      if (!isPix) {
        paymentBody.token = formData.token; // token NOVO do Brick; nunca reutilizamos o da 1ª compra
        paymentBody.installments = formData.installments || 1;
        if (formData.issuer_id) paymentBody.issuer_id = formData.issuer_id;
      }

      await patch({
        checkout_attempts: (o.checkout_attempts || 0) + 1,
        checkout_started_at: o.checkout_started_at || new Date().toISOString(),
      });

      const r = await fetch(`${MP_API}/v1/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `upsell:${o.id}:${o.checkout_attempts}`,
        },
        body: JSON.stringify(paymentBody),
      });
      const mp = await r.json();
      if (!r.ok) {
        console.error("[rand-upsell] mp error", mp?.message);
        return json({ error: "Não foi possível processar o pagamento" }, 400);
      }
      await patch({ upsell_payment_id: String(mp.id), upsell_payment_method: isPix ? "pix" : "card" });

      if (mp.status === "approved") {
        await markPaidIfApproved(mp);
        // Mesmo processador idempotente do webhook: libera acesso e registra venda.
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-mp-sync": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" },
            body: JSON.stringify({ type: "payment", data: { id: String(mp.id) }, source: "rand-upsell" }),
          });
        } catch (e) { console.warn("[rand-upsell] webhook fallback", (e as Error).message); }
      }

      const poi = mp.point_of_interaction?.transaction_data;
      console.log("[rand-upsell] payment", { status: mp.status, method: isPix ? "pix" : "card" });
      return json({
        id: mp.id,
        status: mp.status,
        status_detail: mp.status_detail,
        amount: price,
        currency: "BRL",
        product_id: upsell.id,
        product_name: upsell.name,
        pix: isPix && poi && (poi.qr_code || poi.qr_code_base64)
          ? { qr_code: poi.qr_code, qr_code_base64: poi.qr_code_base64, ticket_url: poi.ticket_url }
          : null,
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("[rand-upsell]", (err as Error).message);
    return json({ error: "Erro interno" }, 500);
  }
});
