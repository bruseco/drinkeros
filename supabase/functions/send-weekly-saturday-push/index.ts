// Push recorrente de sábado 12:00 (America/Sao_Paulo) para todas as assinaturas Web Push ativas.
// - Agendado via pg_cron aos sábados 14:00 e 15:00 UTC; a função só envia quando a hora
//   local em São Paulo é 12h de sábado (seguro contra eventual horário de verão).
// - Idempotente: 1 execução por semana via PK em push_campaign_runs (run_key = campanha + data local).
// - { dry_run: true } conta assinaturas sem enviar nada. { force: true } ignora a checagem de horário (admin/interno).
// - Endpoints 404/410 são removidos (mesmo padrão de send-push-notification).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const CAMPAIGN = "weekly-saturday-drink";
const PAYLOAD = {
  title: "Sábado chegou! 🍹",
  body: "Hoje é o dia ideal para preparar um drink. Abra o Clube dos Drinkeros, escolha uma receita e aproveite.",
  url: "/app/receitas",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function spNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hour12: false, weekday: "short",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, weekday: parts.weekday };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (authFail) return authFail;

  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const dryRun = body?.dry_run === true;
  const force = body?.force === true;

  const sp = spNow();
  const isWindow = sp.weekday === "Sat" && sp.hour === 12;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { count: total } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });

  if (dryRun) {
    return json({ ok: true, dry_run: true, would_send: isWindow || force, sp_time: sp, total_subscriptions: total ?? 0, payload: PAYLOAD });
  }
  if (!isWindow && !force) {
    console.log(`[${CAMPAIGN}] fora da janela`, sp);
    return json({ ok: true, skipped: "outside_window", sp_time: sp });
  }

  const runKey = `${CAMPAIGN}:${sp.date}`;
  const { error: claimErr } = await supabase.from("push_campaign_runs").insert({ run_key: runKey, campaign: CAMPAIGN });
  if (claimErr) {
    console.log(`[${CAMPAIGN}] já executado: ${runKey}`);
    return json({ ok: true, skipped: "already_sent", run_key: runKey });
  }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) {
    await supabase.from("push_campaign_runs").update({ status: "failed", last_error: "VAPID keys not configured", finished_at: new Date().toISOString() }).eq("run_key", runKey);
    return json({ ok: false, error: "VAPID keys not configured" }, 500);
  }
  webpush.setVapidDetails("mailto:contato@drinkeros.com", pub, priv);

  let sent = 0, failed = 0, removed = 0, scanned = 0;
  const payload = JSON.stringify(PAYLOAD);
  const PAGE = 500;
  let lastId: string | null = null;

  try {
    while (true) {
      let q = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").order("id").limit(PAGE);
      if (lastId) q = q.gt("id", lastId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) break;
      for (const sub of data) {
        scanned++;
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 6 * 3600 });
          sent++;
        } catch (err: any) {
          failed++;
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            removed++;
          }
        }
      }
      lastId = data[data.length - 1].id;
      if (data.length < PAGE) break;
    }

    await supabase.from("push_campaign_runs").update({
      status: "success", total_subscriptions: scanned, sent_count: sent, failed_count: failed,
      removed_count: removed, finished_at: new Date().toISOString(),
    }).eq("run_key", runKey);

    const { error: logErr } = await supabase.from("notifications").insert({
      title: PAYLOAD.title, body: PAYLOAD.body, url: PAYLOAD.url, target_type: "all", target_user_ids: [], sent_count: sent,
    });
    if (logErr) console.warn(`[${CAMPAIGN}] histórico não gravado:`, logErr.message);

    console.log(`[${CAMPAIGN}] ${runKey} total=${scanned} sent=${sent} failed=${failed} removed=${removed}`);
    return json({ ok: true, run_key: runKey, total: scanned, sent, failed, removed });
  } catch (e: any) {
    await supabase.from("push_campaign_runs").update({
      status: "failed", total_subscriptions: scanned, sent_count: sent, failed_count: failed, removed_count: removed,
      last_error: String(e?.message || e).slice(0, 500), finished_at: new Date().toISOString(),
    }).eq("run_key", runKey);
    console.error(`[${CAMPAIGN}] erro`, e?.message);
    return json({ ok: false, error: "send_failed" }, 500);
  }
});
