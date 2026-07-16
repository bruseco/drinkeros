import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, dryRun } = await req.json().catch(() => ({ action: "retry_131042", dryRun: false }));

    if (action === "retry_131042") {
      return await retryFailedMessages(supabase, dryRun);
    } else if (action === "fix_upsell_stuck") {
      return await fixUpsellStuck(supabase, dryRun);
    } else {
      return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (err: any) {
    console.error("Error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ===== PART 1: Retry all failed messages with error 131042 =====
async function retryFailedMessages(supabase: any, dryRun: boolean) {
  // Use RPC or raw filter to get only 131042 messages
  // Supabase JS doesn't support JSON numeric equality easily, so we use textSearch on metadata
  const { data: failedMsgs, error: fetchErr } = await supabase
    .from("whatsapp_messages")
    .select("id, conversation_id, metadata")
    .eq("status", "failed")
    .eq("metadata->>error_code", "131042")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) throw fetchErr;
  const msgs131042 = failedMsgs || [];
  if (msgs131042.length === 0) {
    return jsonResponse({ success: true, message: "No 131042 messages to retry", queued: 0, hasMore: false });
  }

  // Batch-fetch conversation phones
  const convIds = [...new Set(msgs131042.map((m: any) => m.conversation_id))];
  const convPhones = new Map<string, string>();
  for (let i = 0; i < convIds.length; i += 50) {
    const { data: convs } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone")
      .in("id", convIds.slice(i, i + 50));
    for (const c of (convs || [])) convPhones.set(c.id, c.phone);
  }

  const sourceToCtx: Record<string, { ctx: string; pri: number }> = {
    upsell_flow: { ctx: "upsell_retry", pri: 5 },
    welcome_flow: { ctx: "welcome_retry", pri: 8 },
    crm_recovery: { ctx: "crm_recovery_retry", pri: 7 },
    crm_pico_blast: { ctx: "crm_recovery_retry", pri: 7 },
    study_reminder: { ctx: "study_reminder_retry", pri: 4 },
    onboarding_followup: { ctx: "onboarding_retry", pri: 5 },
  };

  let queued = 0;
  let skipped = 0;
  const bySource: Record<string, number> = {};

  // Build batch inserts
  const queueInserts: any[] = [];
  const updateIds: string[] = [];

  for (const msg of msgs131042) {
    const phone = convPhones.get(msg.conversation_id);
    const meta = msg.metadata || {};
    const templateName = meta.template_name;
    const source = meta.source || "unknown";

    if (!phone || !templateName) { skipped++; continue; }

    const mapping = sourceToCtx[source] || { ctx: "retry_131042", pri: 3 };

    queueInserts.push({
      phone,
      message: JSON.stringify({ type: "template", template_name: templateName, use_binding: true }),
      context_type: mapping.ctx,
      context_data: { retry_of_message_id: msg.id, original_source: source, template_name: templateName },
      priority: mapping.pri,
      scheduled_at: new Date().toISOString(),
    });
    updateIds.push(msg.id);
    queued++;
    bySource[source] = (bySource[source] || 0) + 1;
  }

  if (!dryRun && queueInserts.length > 0) {
    // Batch insert into queue
    const { error: insertErr } = await supabase.from("whatsapp_send_queue").insert(queueInserts);
    if (insertErr) throw insertErr;

    // Batch update message status
    for (let i = 0; i < updateIds.length; i += 50) {
      await supabase
        .from("whatsapp_messages")
        .update({ status: "retry_queued" })
        .in("id", updateIds.slice(i, i + 50));
    }
  }

  // hasMore = we fetched a full batch, so there are likely more
  const hasMore = msgs131042.length === BATCH_SIZE;

  return jsonResponse({ success: true, queued, skipped, bySource, hasMore, dryRun });
}

// ===== PART 2: Fix stuck upsell sequences =====
async function fixUpsellStuck(supabase: any, dryRun: boolean) {
  // Step 1: Get all active sequences with whatsapp_sent >= 1
  const { data: stuckSeqs, error: seqErr } = await supabase
    .from("upsell_sequences")
    .select("id, user_id, whatsapp_sent, last_whatsapp_at")
    .eq("status", "active")
    .gte("whatsapp_sent", 1)
    .limit(1000);

  if (seqErr) throw seqErr;
  if (!stuckSeqs || stuckSeqs.length === 0) {
    return jsonResponse({ success: true, message: "No stuck sequences", fixed: 0 });
  }

  // Step 2: Batch-fetch phones for all users
  const userIds = [...new Set(stuckSeqs.map((s: any) => s.user_id))];
  const userPhones = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, phone")
      .in("user_id", userIds.slice(i, i + 200));
    for (const p of (profiles || [])) {
      if (p.phone) userPhones.set(p.user_id, p.phone.replace(/\D/g, ""));
    }
  }

  // Step 3: Batch-fetch conversations for all phones
  const phones = [...new Set(userPhones.values())];
  const phoneToConvId = new Map<string, string>();
  for (let i = 0; i < phones.length; i += 200) {
    const chunk = phones.slice(i, i + 200);
    // Query both with and without + prefix
    const { data: convs } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone")
      .in("phone", [...chunk, ...chunk.map((p: string) => `+${p}`)]);
    for (const c of (convs || [])) {
      const normalized = c.phone.replace(/\D/g, "");
      phoneToConvId.set(normalized, c.id);
    }
  }

  // Step 4: Batch-fetch ALL failed upsell messages from relevant conversations
  const convIds = [...new Set(phoneToConvId.values())];
  const failedByConv = new Map<string, number>(); // convId -> count of failed upsell msgs

  for (let i = 0; i < convIds.length; i += 50) {
    const chunk = convIds.slice(i, i + 50);
    const { data: msgs } = await supabase
      .from("whatsapp_messages")
      .select("id, conversation_id, metadata")
      .in("conversation_id", chunk)
      .in("status", ["failed", "retry_queued"]);

    for (const m of (msgs || [])) {
      const meta = m.metadata || {};
      if (meta.source === "upsell_flow" && (meta.error_code === 131042 || (meta.error_message || "").includes("payment issue"))) {
        failedByConv.set(m.conversation_id, (failedByConv.get(m.conversation_id) || 0) + 1);
      }
    }
  }

  // Step 5: Fix each sequence
  let fixed = 0;
  let alreadyOk = 0;
  let noConv = 0;

  for (const seq of stuckSeqs) {
    const phone = userPhones.get(seq.user_id);
    if (!phone) { noConv++; continue; }

    const convId = phoneToConvId.get(phone);
    if (!convId) { noConv++; continue; }

    const failedCount = failedByConv.get(convId) || 0;
    if (failedCount === 0) { alreadyOk++; continue; }

    const corrected = Math.max(0, seq.whatsapp_sent - failedCount);
    if (corrected === seq.whatsapp_sent) { alreadyOk++; continue; }

    if (!dryRun) {
      await supabase
        .from("upsell_sequences")
        .update({
          whatsapp_sent: corrected,
          last_whatsapp_at: corrected === 0 ? null : seq.last_whatsapp_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seq.id);
    }
    fixed++;
    console.log(`Fixed ${seq.id}: whatsapp_sent ${seq.whatsapp_sent} -> ${corrected}`);
  }

  return jsonResponse({ success: true, total: stuckSeqs.length, fixed, alreadyOk, noConv, dryRun });
}
