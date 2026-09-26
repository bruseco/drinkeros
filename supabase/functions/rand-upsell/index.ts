// Oferta pós-compra do RAND: combo existente "Pacote Business" (slug pacote-business) por R$97 fixos.
//  - progress { ref, watched }  → progresso assistido (validado contra o relógio do servidor)
//  - reveal   { ref }           → após 3:45 assistidos grava revealed_at e prazo real de 5 min (uma vez)
//  - track    { ref, event }    → eventos idempotentes (video_*, accept, decline)
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
const OFFER_KEY = "rand-pacote-business";
const SOURCE_SLUG = "rand";
const UPSELL_SLUG = "pacote-business";
const UPSELL_PRICE = 97;
const RECENT_HOURS = 24;
const MAX_CHECKOUT_ATTEMPTS = 5;
const REVEAL_AFTER_SECONDS = 225;
const OFFER_WINDOW_SECONDS = 300;
const TRACK_EVENTS = new Set(["video_start", "video_25", "video_50", "video_75", "video_90", "video_complete", "accept", "decline"]);
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
    // Preço exclusivo do upsell, fixo no servidor (o preço normal do combo não é usado nem alterado).
    const price = UPSELL_PRICE;

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
    const nowMs = Date.now();
    const deadlineMs = o.offer_deadline_at ? new Date(o.offer_deadline_at).getTime() : null;
    // Antes da revelação vale a janela segura (expires_at, 6h após a compra); depois, o prazo real de 5 min.
    const expired = deadlineMs !== null ? deadlineMs < nowMs : new Date(o.expires_at).getTime() < nowMs;
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
      watched_seconds: Number(o.watched_seconds) || 0,
      revealed_at: o.revealed_at,
      offer_deadline_at: o.offer_deadline_at,
      server_now: new Date().toISOString(),
      reveal_after_seconds: REVEAL_AFTER_SECONDS,
      checkout_open: !!o.upsell_payment_id && o.status !== "paid",
    });

    const patch = async (fields: Record<string, unknown>) => {
      await db.from("post_purchase_offers").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", ref);
      Object.assign(o, fields);
    };

    if (action === "get") return json(await baseState());

    const mark = (ev: string) => db.rpc("ppo_mark_event", { _offer_id: o.id, _event: ev });

    if (action === "track") {
      const ev = String(body?.event || "");
      const now = new Date().toISOString();
      if (ev === "view") { if (!o.viewed_at) await patch({ viewed_at: now }); return json({ ok: true }); }
      if (!TRACK_EVENTS.has(ev)) return json({ error: "Evento inválido" }, 400);
      if (o.status === "paid") return json({ ok: true });
      if ((ev === "accept" || ev === "decline") && !o.revealed_at) return json({ error: "Oferta ainda não revelada" }, 409);
      if (ev === "accept" && o.status === "declined") return json({ error: "Oferta recusada", code: "declined" }, 409);
      await mark(ev);
      if (ev === "accept" && !o.accepted_at) await patch({ accepted_at: now, status: o.status === "offered" ? "accepted" : o.status });
      if (ev === "decline" && !o.declined_at) await patch({ declined_at: now, status: "declined" });
      return json({ ok: true });
    }

    if (action === "progress") {
      // Não confiamos no cliente: o avanço é limitado pelo tempo real decorrido desde a última atualização.
      const reported = Math.max(0, Math.min(Number(body?.watched) || 0, 7200));
      const prev = Number(o.watched_seconds) || 0;
      const lastMs = o.progress_updated_at ? new Date(o.progress_updated_at).getTime() : null;
      const allowed = lastMs === null ? 20 : ((nowMs - lastMs) / 1000) * 1.1 + 5;
      const next = Math.min(reported, prev + allowed);
      if (next > prev) await patch({ watched_seconds: Math.round(next * 10) / 10, progress_updated_at: new Date(nowMs).toISOString() });
      else if (lastMs === null) await patch({ progress_updated_at: new Date(nowMs).toISOString() });
      return json({ watched_seconds: Number(o.watched_seconds) || 0 });
    }

    if (action === "reveal") {
      if (o.revealed_at) return json(await baseState());
      if (o.status === "paid" || o.status === "declined" || expired) return json(await baseState());
      if ((Number(o.watched_seconds) || 0) < REVEAL_AFTER_SECONDS - 10) {
        return json({ error: "Vídeo ainda não assistido", code: "not_ready", watched_seconds: Number(o.watched_seconds) || 0 }, 409);
      }
      const revealedAt = new Date(nowMs);
      const deadline = new Date(nowMs + OFFER_WINDOW_SECONDS * 1000);
      // Atômico: só a primeira aba grava; as demais leem o mesmo prazo (não reinicia).
      await db.from("post_purchase_offers")
        .update({ revealed_at: revealedAt.toISOString(), offer_deadline_at: deadline.toISOString(), updated_at: revealedAt.toISOString() })
        .eq("id", o.id).is("revealed_at", null);
      await mark("offer_revealed");
      const { data: fresh } = await db.from("post_purchase_offers").select("*").eq("id", o.id).single();
      Object.assign(o, fresh);
      return json(await baseState());
    }

    const markPaidIfApproved = async (payment: any) => {
      if (payment?.status === "approved" && o.status !== "paid") {
        await patch({ status: "paid", paid_at: new Date().toISOString(), amount: Number(payment.transaction_amount) || price });
        await mark("paid");
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
      if (!o.revealed_at || !o.offer_deadline_at) return json({ error: "Oferta ainda não revelada", code: "not_revealed" }, 409);
      if (expired) return json({ error: "O prazo da oferta terminou", code: "expired" }, 409);
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

      // Trava otimista: cliques duplos / múltiplas abas não geram duas cobranças na mesma tentativa.
      const attempt = (o.checkout_attempts || 0) + 1;
      const { data: locked } = await db.from("post_purchase_offers").update({
        checkout_attempts: attempt,
        checkout_started_at: o.checkout_started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", o.id).eq("checkout_attempts", o.checkout_attempts || 0).neq("status", "paid").select("id");
      if (!locked?.length) return json({ error: "Pagamento já em processamento", code: "busy" }, 409);
      o.checkout_attempts = attempt;
      await mark("checkout_started");

      const r = await fetch(`${MP_API}/v1/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mpToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `upsell:${o.id}:${attempt}`,
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
