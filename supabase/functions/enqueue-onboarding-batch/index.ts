import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGIN_URL = "https://alunos.criminallab.com.br/login";
const FOLLOWUP_PROCESS = "onboarding_followup";
const ENROLLMENT_CUTOFF = "2026-02-15T23:59:59+00:00";
const BATCH_SIZE = 100;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

/**
 * Calculate scheduled_at: 100 contacts per hour, 8h-21h BRT (UTC-3)
 */
function calculateScheduledAt(index: number, now: Date): string {
  const brtOffset = -3;
  const brtNow = new Date(now.getTime() + brtOffset * 60 * 60 * 1000);
  const brtHour = brtNow.getUTCHours();

  let startDate = new Date(brtNow);
  if (brtHour < 8) {
    startDate.setUTCHours(8, 0, 0, 0);
  } else if (brtHour >= 21) {
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    startDate.setUTCHours(8, 0, 0, 0);
  }

  const batchNumber = Math.floor(index / 100);
  const scheduledBrt = new Date(startDate.getTime() + batchNumber * 60 * 60 * 1000);

  let scheduledBrtHour = scheduledBrt.getUTCHours();
  if (scheduledBrtHour >= 21) {
    const extraHours = scheduledBrtHour - 21;
    scheduledBrt.setUTCDate(scheduledBrt.getUTCDate() + 1);
    scheduledBrt.setUTCHours(8 + extraHours, 0, 0, 0);
  }

  const utcScheduled = new Date(scheduledBrt.getTime() - brtOffset * 60 * 60 * 1000);
  return utcScheduled.toISOString();
}

async function fetchAllRows(supabase: any, table: string, selectFields: string, filters?: { field: string; op: string; value: string }[]): Promise<any[]> {
  const allRows: any[] = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(selectFields);
    if (filters) {
      for (const f of filters) {
        if (f.op === "lte") query = query.lte(f.field, f.value);
        if (f.op === "gte") query = query.gte(f.field, f.value);
      }
    }
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

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

    console.log(`[enqueue-onboarding-batch] Starting...`);

    // ─── 1. Enrolled users with date filter ───
    const dateFilter = [{ field: "purchased_at", op: "lte", value: ENROLLMENT_CUTOFF }];
    const [pkgUsers, courseUsers, comboUsers] = await Promise.all([
      fetchAllRows(supabase, "user_packages", "user_id", dateFilter),
      fetchAllRows(supabase, "user_courses", "user_id", dateFilter),
      fetchAllRows(supabase, "user_combos", "user_id", dateFilter),
    ]);

    const enrolledUserIds = new Set<string>();
    for (const e of [...pkgUsers, ...courseUsers, ...comboUsers]) {
      enrolledUserIds.add(e.user_id);
    }
    console.log(`[enqueue-onboarding-batch] Total enrolled: ${enrolledUserIds.size}`);

    // ─── 2. Exclude admins ───
    const adminRoles = await fetchAllRows(supabase, "user_roles", "user_id, role");
    const adminSet = new Set(
      adminRoles
        .filter((r: any) => r.role === "super_admin" || r.role === "editor")
        .map((r: any) => r.user_id)
    );

    // ─── 3. Exclude already logged in onboarding_followup_logs ───
    const alreadyNotified = await fetchAllRows(supabase, "onboarding_followup_logs", "user_id");
    const notifiedSet = new Set(alreadyNotified.map((r: any) => r.user_id));

    // ─── 4. Exclude users who have accessed ───
    const viewedUsers = await fetchAllRows(supabase, "recipe_views", "user_id");
    const viewedSet = new Set(viewedUsers.map((r: any) => r.user_id));

    // ─── 5. Filter eligible ───
    const eligibleUserIds = Array.from(enrolledUserIds).filter(
      (uid) => !adminSet.has(uid) && !notifiedSet.has(uid) && !viewedSet.has(uid)
    );
    console.log(`[enqueue-onboarding-batch] Eligible: ${eligibleUserIds.length}`);

    if (eligibleUserIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No eligible users remaining",
        total_eligible: 0,
        queued: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── 6. Get profiles for eligible users (paginated in chunks of 200) ───
    const profileChunks: any[] = [];
    for (let i = 0; i < eligibleUserIds.length; i += 200) {
      const chunk = eligibleUserIds.slice(i, i + 200);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, phone")
        .in("user_id", chunk);
      if (error) console.error(`[enqueue-onboarding-batch] Profile chunk error:`, error.message);
      if (data) profileChunks.push(...data);
    }

    // Deduplicate
    const seenUserIds = new Set<string>();
    const uniqueProfiles: any[] = [];
    for (const p of profileChunks) {
      if (!seenUserIds.has(p.user_id)) {
        seenUserIds.add(p.user_id);
        uniqueProfiles.push(p);
      }
    }
    uniqueProfiles.sort((a, b) => a.user_id.localeCompare(b.user_id));

    const totalEligible = uniqueProfiles.length;

    // ─── 7. Take next BATCH_SIZE users ───
    const batch = uniqueProfiles.slice(0, BATCH_SIZE);

    // ─── 8. Get Era Cloud connection ───
    const { data: eraConn } = await supabase
      .from("zapi_connections")
      .select("id, token, api_url, phone_number")
      .eq("is_active", true)
      .eq("provider", "era_cloud")
      .limit(1)
      .maybeSingle();

    if (!eraConn) {
      return new Response(JSON.stringify({
        success: false,
        error: "No active Era Cloud connection found",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── 9. Get template binding ───
    const { data: allBindings } = await supabase
      .from("whatsapp_template_bindings")
      .select("id, template_name, variable_map")
      .eq("connection_id", eraConn.id)
      .eq("process", FOLLOWUP_PROCESS)
      .eq("is_active", true);

    if (!allBindings || allBindings.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `No active template binding found for process '${FOLLOWUP_PROCESS}'`,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── 10. Enqueue batch ───
    let queued = 0;
    let errors = 0;
    const now = new Date();

    for (let i = 0; i < batch.length; i++) {
      const profile = batch[i];

      // Only WhatsApp if phone available
      if (!profile.phone) {
        // Still mark as notified via onboarding_followup_logs (email only)
        await supabase.from("onboarding_followup_logs").upsert({
          user_id: profile.user_id,
          phone: null,
          email: profile.email,
          whatsapp_sent: false,
          email_sent: false,
        }, { onConflict: "user_id" });
        continue;
      }

      try {
        const phone = normalizePhone(profile.phone);
        const firstName = profile.full_name?.split(" ")[0] || "aluno(a)";
        const binding = allBindings[Math.floor(Math.random() * allBindings.length)];
        const varMap = (binding.variable_map || {}) as Record<string, string>;
        const variableValues: Record<string, string> = {
          student_name: firstName,
          login_url: LOGIN_URL,
        };

        const message = JSON.stringify({
          type: "template",
          template_name: binding.template_name,
          variable_map: varMap,
          variables: variableValues,
        });

        const scheduledAt = calculateScheduledAt(i, now);

        await supabase.from("whatsapp_send_queue").insert({
          phone,
          message,
          context_type: "onboarding_followup",
          priority: 5,
          context_data: {
            user_id: profile.user_id,
            profile_id: profile.id,
            full_name: profile.full_name,
            binding_id: binding.id,
          },
          scheduled_at: scheduledAt,
          zapi_connection_id: eraConn.id,
        });

        // Mark as queued in logs (whatsapp_sent=false means "queued but not yet sent")
        await supabase.from("onboarding_followup_logs").upsert({
          user_id: profile.user_id,
          phone: profile.phone,
          email: profile.email,
          whatsapp_sent: false,
          email_sent: false,
        }, { onConflict: "user_id" });

        queued++;
        console.log(`[enqueue-onboarding-batch] Queued ${phone} (scheduled: ${scheduledAt})`);
      } catch (err: any) {
        errors++;
        console.error(`[enqueue-onboarding-batch] Error for ${profile.phone}:`, err.message);
      }
    }

    const remaining = Math.max(0, totalEligible - BATCH_SIZE);
    console.log(`[enqueue-onboarding-batch] Done: queued=${queued}, errors=${errors}, remaining=${remaining}`);

    return new Response(JSON.stringify({
      success: true,
      total_eligible: totalEligible,
      batch_size: BATCH_SIZE,
      queued,
      errors,
      remaining,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[enqueue-onboarding-batch] Fatal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
