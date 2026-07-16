import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") !== "false";
    const batchSize = parseInt(url.searchParams.get("batch") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get logs in batches
    const { data: logs, error: logsErr } = await supabase
      .from("onboarding_followup_logs")
      .select("*")
      .eq("whatsapp_sent", true)
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (logsErr) throw logsErr;

    // Get total count
    const { count } = await supabase
      .from("onboarding_followup_logs")
      .select("*", { count: "exact", head: true })
      .eq("whatsapp_sent", true)
      .not("phone", "is", null);

    console.log(`Processing batch: offset=${offset}, size=${logs.length}, total=${count}`);

    let created = 0;
    let skippedExisting = 0;
    let conversationsCreated = 0;

    for (const log of logs) {
      const phone = log.phone.replace(/^\+/, "");

      // Find conversation
      let { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.+${phone}`)
        .maybeSingle();

      if (!conv) {
        if (dryRun) {
          created++;
          conversationsCreated++;
          continue;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("user_id", log.user_id)
          .maybeSingle();

        const { data: newConv, error: convErr } = await supabase
          .from("whatsapp_conversations")
          .insert({
            phone,
            profile_id: profile?.id || null,
            contact_name: profile?.full_name || null,
            status: "open",
            agent_mode: "ai",
          })
          .select("id")
          .single();

        if (convErr) {
          console.error(`Conv error ${phone}:`, convErr.message);
          continue;
        }
        conv = newConv;
        conversationsCreated++;
      }

      // Check existing message
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("direction", "outbound")
        .contains("metadata", { source: "onboarding_followup_batch" })
        .limit(1);

      if (existing && existing.length > 0) {
        skippedExisting++;
        continue;
      }

      if (!dryRun) {
        const { error: msgErr } = await supabase
          .from("whatsapp_messages")
          .insert({
            conversation_id: conv.id,
            direction: "outbound",
            message_type: "template",
            content: "[Template onboarding_followup] Reforço de onboarding",
            status: "sent",
            metadata: { source: "onboarding_followup_batch", backfilled: true },
            created_at: log.created_at,
          });

        if (msgErr) {
          console.error(`Msg error ${conv.id}:`, msgErr.message);
          continue;
        }
      }
      created++;
    }

    const hasMore = offset + batchSize < (count || 0);
    const result = {
      dry_run: dryRun,
      batch_offset: offset,
      batch_size: logs.length,
      total: count,
      messages_created: created,
      skipped_existing: skippedExisting,
      conversations_created: conversationsCreated,
      has_more: hasMore,
      next_offset: hasMore ? offset + batchSize : null,
    };

    console.log("Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
