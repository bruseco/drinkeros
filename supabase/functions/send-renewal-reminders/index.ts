// Daily job: scans VIP users and sends renewal reminder emails based on
// how many days remain until expires_at (or how many days have passed).
// Each user receives each reminder at most once per cycle (per expires_at value).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[send-renewal-reminders] ${step}${details ? " — " + JSON.stringify(details) : ""}`);
};

// Map: days remaining → template name. Negative numbers = days AFTER expiry.
const REMINDER_WINDOWS: { days: number; template: string }[] = [
  { days: 30, template: "clube-renewal-30d" },
  { days: 10, template: "clube-renewal-10d" },
  { days: 5, template: "clube-renewal-5d" },
  { days: 3, template: "clube-renewal-3d" },
  { days: 1, template: "clube-renewal-1d" },
  { days: 0, template: "clube-renewal-0d" },
  { days: -3, template: "clube-renewal-plus3d" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Window: look at users expiring in the next 31 days OR expired up to 5 days ago
    const now = new Date();
    const upper = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
    const lower = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: plans, error } = await supabase
      .from("user_plans")
      .select("user_id, expires_at")
      .eq("plan", "vip")
      .not("expires_at", "is", null)
      .gte("expires_at", lower)
      .lte("expires_at", upper);

    if (error) throw error;
    log("found-candidates", { count: plans?.length ?? 0 });

    if (!plans || plans.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let skipped = 0;

    for (const plan of plans) {
      const expiresAt = new Date(plan.expires_at!);
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

      // Find the matching window (exact day match)
      const window = REMINDER_WINDOWS.find((w) => w.days === diffDays);
      if (!window) {
        skipped++;
        continue;
      }

      // Skip if user has lifetime access
      const { data: lifetime } = await supabase
        .from("user_lifetime_access")
        .select("id")
        .eq("user_id", plan.user_id)
        .maybeSingle();
      if (lifetime) {
        skipped++;
        continue;
      }

      // Idempotency: already sent for this exact expires_at?
      const { data: alreadySent } = await supabase
        .from("vip_renewal_reminders_sent")
        .select("template")
        .eq("user_id", plan.user_id)
        .eq("template", window.template)
        .eq("expires_at_snapshot", plan.expires_at!)
        .maybeSingle();

      if (alreadySent) {
        skipped++;
        continue;
      }

      // Get user's email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", plan.user_id)
        .maybeSingle();

      if (!profile?.email) {
        log("no-email", { user_id: plan.user_id });
        skipped++;
        continue;
      }

      // Enqueue the transactional email
      const sendRes = await sendTemplateEmailWithLog(supabase, {
        templateName: window.template,
        recipientEmail: profile.email,
        idempotencyKey: `renewal-${plan.user_id}-${window.template}-${plan.expires_at}`,
        templateData: {
          name: profile.full_name?.split(" ")[0] ?? "",
          expires_at: plan.expires_at,
          days_remaining: diffDays,
        },
      });

      if (!sendRes.success) {
        log("send-failed", { user_id: plan.user_id, error: sendRes.error });
        continue;
      }

      // Record send
      await supabase.from("vip_renewal_reminders_sent").insert({
        user_id: plan.user_id,
        template: window.template,
        expires_at_snapshot: plan.expires_at!,
      });

      sent++;
    }

    log("done", { sent, skipped });
    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", { error: (err as Error).message });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
