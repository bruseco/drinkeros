import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { enqueueEmail } from "../_shared/enqueue-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Read settings ────────────────────────────────────────
    const { data: settings } = await supabase
      .from("onboarding_reminder_settings")
      .select("*")
      .limit(1)
      .single();

    const isEnabled = settings?.is_enabled ?? true;
    const firstDays = settings?.inactive_days ?? 3;
    const secondDays = settings?.second_reminder_days ?? 7;
    const secondEnabled = settings?.second_reminder_enabled ?? true;

    // Parse optional body override
    let forceRun = false;
    let overrideDays: number | null = null;
    try {
      const body = await req.json();
      if (body?.inactiveDays) {
        overrideDays = parseInt(body.inactiveDays, 10);
      }
      if (body?.forceRun) {
        forceRun = true;
      }
    } catch {
      // No body — use defaults
    }

    if (!isEnabled && !forceRun) {
      return new Response(
        JSON.stringify({ success: true, message: "Onboarding reminders are disabled", pushSent: 0, emailsSent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Configure VAPID
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const hasVapid = !!vapidPublicKey && !!vapidPrivateKey;

    if (hasVapid) {
      webpush.setVapidDetails(
        "mailto:admin@criminallab.com.br",
        vapidPublicKey!,
        vapidPrivateKey!
      );
    }

    // ─── Build list of day thresholds to process ──────────────
    const dayThresholds: number[] = overrideDays
      ? [overrideDays]
      : [firstDays, ...(secondEnabled ? [secondDays] : [])];

    // Deduplicate
    const uniqueDays = [...new Set(dayThresholds)];

    // Exclude admins (fetch once)
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "editor"]);
    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    // Email settings (fetch once)
    const [settingsResult, templateResult] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "onboarding-reminder").single(),
    ]);

    const senderName = settingsResult.data?.sender_name || "Drinkeros";
    const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = settingsResult.data?.reply_to_email || undefined;
    const subject = templateResult.data?.subject || "📚 Seu curso está esperando por você!";
    const htmlTemplate = templateResult.data?.html_body || "";
    const loginUrl = "https://criminallab.lovable.app/login";

    let totalPushSent = 0;
    let totalEmailsSent = 0;
    let totalEligible = 0;
    const allPushErrors: { endpoint: string; error: string }[] = [];
    const allEmailErrors: { email: string; error: string }[] = [];
    const results: { days: number; eligible: number; pushSent: number; emailsSent: number }[] = [];

    for (const days of uniqueDays) {
      // ─── Find users who signed up X days ago and never accessed ─
      const signupCutoff = new Date();
      signupCutoff.setDate(signupCutoff.getDate() - days);
      const signupStart = new Date(signupCutoff);
      signupStart.setHours(0, 0, 0, 0);
      const signupEnd = new Date(signupCutoff);
      signupEnd.setHours(23, 59, 59, 999);

      console.log(`[${days}d] Looking for users who signed up between ${signupStart.toISOString()} and ${signupEnd.toISOString()}`);

      const { data: newProfiles, error: profError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, created_at")
        .gte("created_at", signupStart.toISOString())
        .lte("created_at", signupEnd.toISOString());

      if (profError) throw profError;
      if (!newProfiles || newProfiles.length === 0) {
        console.log(`[${days}d] No users signed up on target day`);
        results.push({ days, eligible: 0, pushSent: 0, emailsSent: 0 });
        continue;
      }

      const userIds = newProfiles.map((p: any) => p.user_id);

      // Check which users have ANY recipe views
      const { data: viewers } = await supabase
        .from("recipe_views")
        .select("user_id")
        .in("user_id", userIds);
      const viewerIds = new Set((viewers || []).map((v: any) => v.user_id));

      // Filter: signed up on target day, no views ever, not admin
      const eligibleProfiles = newProfiles.filter(
        (p: any) => !viewerIds.has(p.user_id) && !adminIds.has(p.user_id)
      );

      console.log(`[${days}d] Found ${eligibleProfiles.length} eligible users`);

      if (eligibleProfiles.length === 0) {
        results.push({ days, eligible: 0, pushSent: 0, emailsSent: 0 });
        continue;
      }

      const eligibleUserIds = eligibleProfiles.map((p: any) => p.user_id);
      totalEligible += eligibleProfiles.length;

      // ─── Push Notifications ───────────────────────────────────
      let pushSent = 0;

      if (hasVapid) {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("*")
          .in("user_id", eligibleUserIds);

        const pushPayload = JSON.stringify({
          title: "📚 Seu curso está esperando por você!",
          body: days <= 3
            ? "Você se cadastrou mas ainda não acessou suas aulas. Comece agora!"
            : `Já faz ${days} dias que você se cadastrou e ainda não acessou. Suas aulas estão te esperando!`,
          url: "/app",
        });

        for (const sub of (subscriptions || [])) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              pushPayload
            );
            pushSent++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
            allPushErrors.push({ endpoint: sub.endpoint, error: err.message || String(err) });
          }
        }
      }

      // ─── Email Notifications ──────────────────────────────────
      let emailsSent = 0;

      if (htmlTemplate) {
        for (const profile of eligibleProfiles) {
          const userName = profile.full_name || profile.email.split("@")[0];

          let html = htmlTemplate
            .replaceAll("{{user_name}}", userName)
            .replaceAll("{{email}}", profile.email)
            .replaceAll("{{inactive_days}}", String(days))
            .replaceAll("{{login_url}}", loginUrl);

          try {
            const result = await enqueueEmail(supabase, {
              to: profile.email,
              subject,
              html,
              label: "onboarding-reminder",
              idempotencyKey: `onboarding-reminder-${profile.user_id}-${days}d-${new Date().toISOString().slice(0, 10)}`,
            });
            if (result.success) {
              emailsSent++;
            } else {
              allEmailErrors.push({ email: profile.email, error: result.error || "enqueue failed" });
            }
          } catch (err: any) {
            allEmailErrors.push({ email: profile.email, error: err.message || String(err) });
          }
        }
      }

      totalPushSent += pushSent;
      totalEmailsSent += emailsSent;

      // ─── Log the reminder ─────────────────────────────────────
      await supabase.from("notifications").insert({
        title: "🎓 Lembrete de Onboarding",
        body: `Lembrete automático (${days}d): ${eligibleProfiles.length} aluno(s) sem acesso. Push: ${pushSent}, Email: ${emailsSent}.`,
        url: "/app",
        target_type: "onboarding_reminder",
        target_user_ids: eligibleUserIds,
        sent_count: pushSent + emailsSent,
        sent_by: "00000000-0000-0000-0000-000000000000",
      });

      // ─── Timeline events ──────────────────────────────────────
      try {
        const timelineInserts = eligibleProfiles.map((p: any) => ({
          event_type: "onboarding_reminder",
          event_subtype: "sent",
          user_id: p.user_id,
          phone: p.phone || null,
          channel: pushSent > 0 ? "push" : "email",
          summary: `Lembrete de onboarding (${days}d) enviado para ${p.full_name || p.email}`,
          metadata: { days, push: pushSent > 0, email: emailsSent > 0 },
        }));
        // Insert in batches of 50
        for (let ti = 0; ti < timelineInserts.length; ti += 50) {
          await supabase.from("cs_timeline_events").insert(timelineInserts.slice(ti, ti + 50));
        }
      } catch (tlErr: any) {
        console.error(`[${days}d] Timeline insert error:`, tlErr.message);
      }

      results.push({ days, eligible: eligibleProfiles.length, pushSent, emailsSent });
    }

    console.log(`Onboarding reminders total: push=${totalPushSent}, email=${totalEmailsSent}, eligible=${totalEligible}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalEligible,
        totalPushSent,
        totalEmailsSent,
        batches: results,
        pushErrors: allPushErrors.length > 0 ? allPushErrors : undefined,
        emailErrors: allEmailErrors.length > 0 ? allEmailErrors : undefined,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending onboarding reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
