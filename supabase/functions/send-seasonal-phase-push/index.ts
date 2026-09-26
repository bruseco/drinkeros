// Push automático de início de fase sazonal — 18:00 America/Sao_Paulo.
// Calendário: ../_shared/seasonalPhases.ts (MESMA fonte usada pelo app em /app/receitas).
// - Cron diário 20:00 e 21:00 UTC; só envia quando é 18h em São Paulo e a fase principal
//   mudou em relação ao dia anterior (sem retroativo).
// - Idempotência: push_campaign_runs.run_key = "seasonal-phase:<fase>:<ano>" (1 por fase/ano).
// - { dry_run: true, date?: "YYYY-MM-DD" } simula sem enviar. { force: true } ignora a hora (interno/admin).
// - Remove endpoints 404/410, igual a send-push-notification / send-weekly-saturday-push.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";
import { getPrimaryPhaseStartingOn, PHASE_PUSH_TITLES } from "../_shared/seasonalPhases.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const CAMPAIGN = "seasonal-phase";
const BODY = "Já separamos receitas especiais para esta época. Abra o Clube dos Drinkeros e escolha a sua.";
const SEND_HOUR = 18;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function spNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

function localDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
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
  // Data simulada só é aceita em dry-run
  const dateIso = dryRun && /^\d{4}-\d{2}-\d{2}$/.test(body?.date ?? "") ? body.date : sp.date;
  const phase = getPrimaryPhaseStartingOn(localDate(dateIso));
  const isHour = sp.hour === SEND_HOUR;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const payloadObj = phase
    ? { title: PHASE_PUSH_TITLES[phase.id], body: BODY, url: `/app/receitas?categoria=${encodeURIComponent(phase.tags[0])}` }
    : null;
  const runKey = phase ? `${CAMPAIGN}:${phase.id}:${dateIso.slice(0, 4)}` : null;

  if (dryRun) {
    const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
    let alreadySent = false;
    if (runKey) {
      const { data } = await supabase.from("push_campaign_runs").select("run_key").eq("run_key", runKey).maybeSingle();
      alreadySent = !!data;
    }
    return json({ ok: true, dry_run: true, date: dateIso, sp_time: sp, phase_starting: phase?.id ?? null, run_key: runKey, already_sent: alreadySent, total_subscriptions: count ?? 0, payload: payloadObj });
  }

  if (!isHour && !force) return json({ ok: true, skipped: "outside_window", sp_time: sp });
  if (!phase || !payloadObj || !runKey) return json({ ok: true, skipped: "no_phase_start", date: dateIso });

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
  const payload = JSON.stringify(payloadObj);
  let lastId: string | null = null;
  try {
    while (true) {
      let q = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").order("id").limit(500);
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
      if (data.length < 500) break;
    }
    await supabase.from("push_campaign_runs").update({
      status: "success", total_subscriptions: scanned, sent_count: sent, failed_count: failed, removed_count: removed, finished_at: new Date().toISOString(),
    }).eq("run_key", runKey);
    const { error: logErr } = await supabase.from("notifications").insert({
      title: payloadObj.title, body: payloadObj.body, url: payloadObj.url, target_type: "all", target_user_ids: [], sent_count: sent,
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
