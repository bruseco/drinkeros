// Reconciliação de pagamentos do Mercado Pago.
// Busca pagamentos aprovados dos últimos dias direto na API do MP e reprocessa
// aqueles que não têm compra registrada (webhook perdido / notificação não entregue).
// Roda por cron a cada 15 minutos e também pode ser chamado manualmente pelo admin.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const MP_API = "https://api.mercadopago.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await assertInternalOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days) || 3, 1), 30);
    const dryRun = body?.dry_run === true;

    const beginDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(Date.now() + 60_000).toISOString();

    // 1) Lista pagamentos aprovados no período (paginado)
    const approved: Array<{ id: string; amount: number; date: string }> = [];
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      const qs = new URLSearchParams({
        sort: "date_created",
        criteria: "desc",
        range: "date_created",
        begin_date: beginDate,
        end_date: endDate,
        status: "approved",
        limit: "50",
        offset: String(offset),
      });
      const r = await fetch(`${MP_API}/v1/payments/search?${qs}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      const data = await r.json();
      if (!r.ok) {
        console.error("[mp-reconcile] search failed", data);
        break;
      }
      const results = (data?.results || []) as any[];
      for (const p of results) {
        approved.push({
          id: String(p.id),
          amount: Number(p.transaction_amount || 0),
          date: String(p.date_approved || p.date_created || ""),
        });
      }
      const total = Number(data?.paging?.total || 0);
      offset += results.length;
      if (results.length === 0 || offset >= total) break;
    }

    if (approved.length === 0) {
      console.log("[mp-reconcile] nenhum pagamento aprovado no período", { days });
      return json({ ok: true, checked: 0, missing: 0, reprocessed: 0 });
    }

    // 2) Quais já estão registrados em purchases
    const ids = approved.map((p) => p.id);
    const { data: existing } = await supabase
      .from("purchases")
      .select("transaction_id")
      .eq("gateway", "mercado_pago")
      .in("transaction_id", ids);
    const known = new Set((existing || []).map((r: any) => String(r.transaction_id)));

    // Ignora autorizações de R$ 0 (assinatura recém-criada): não geram venda.
    const missing = approved.filter((p) => !known.has(p.id) && p.amount > 0);


    if (dryRun) {
      return json({ ok: true, checked: approved.length, missing: missing.length, ids: missing });
    }

    // 3) Reprocessa via webhook (mesma lógica de liberação de acesso)
    const results: Array<Record<string, unknown>> = [];
    for (const p of missing) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/mercadopago-webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-mp-sync": serviceKey,
          },
          body: JSON.stringify({ type: "payment", data: { id: p.id } }),
        });
        const out = await r.json().catch(() => ({}));
        results.push({ payment_id: p.id, amount: p.amount, ok: r.ok, result: out });
        console.log("[mp-reconcile] reprocessado", p.id, out);
      } catch (e) {
        results.push({ payment_id: p.id, ok: false, error: (e as Error).message });
        console.error("[mp-reconcile] falha ao reprocessar", p.id, e);
      }
    }

    console.log("[mp-reconcile]", {
      days,
      checked: approved.length,
      missing: missing.length,
    });

    return json({
      ok: true,
      checked: approved.length,
      missing: missing.length,
      reprocessed: results.length,
      results,
    });
  } catch (err) {
    console.error("[mp-reconcile]", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
