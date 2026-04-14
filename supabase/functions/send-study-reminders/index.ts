import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { enqueueEmail } from "../_shared/enqueue-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: batch an array into chunks
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Read settings from DB ────────────────────────────────
    const { data: settings } = await supabase
      .from("study_reminder_settings")
      .select("*")
      .limit(1)
      .single();

    const isEnabled = settings?.is_enabled ?? true;
    let inactiveDays = settings?.inactive_days ?? 7;

    // Parse optional body override (useful for manual tests)
    let forceRun = false;
    try {
      const body = await req.json();
      if (body?.inactiveDays) {
        inactiveDays = parseInt(body.inactiveDays, 10);
      }
      if (body?.forceRun) {
        forceRun = true;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // If disabled and not a forced manual run, skip
    if (!isEnabled && !forceRun) {
      return new Response(
        JSON.stringify({ success: true, message: "Study reminders are disabled", pushSent: 0, emailsSent: 0 }),
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

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`Looking for users inactive since ${cutoffISO} (${inactiveDays} days)`);

    // ─── Exclude admins ───────────────────────────────────────
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id");

    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    // ─── Find ALL users who ever accessed (have recipe_views) ──
    const BATCH_SIZE = 500;
    const allViewerIds = new Set<string>();
    let rvOffset = 0;
    let rvHasMore = true;

    while (rvHasMore) {
      const { data: rvBatch, error: rvError } = await supabase
        .from("recipe_views")
        .select("user_id")
        .range(rvOffset, rvOffset + BATCH_SIZE - 1);

      if (rvError) throw rvError;
      if (!rvBatch || rvBatch.length === 0) { rvHasMore = false; break; }

      for (const rv of rvBatch) allViewerIds.add(rv.user_id);

      if (rvBatch.length < BATCH_SIZE) rvHasMore = false;
      else rvOffset += BATCH_SIZE;
    }

    console.log(`Found ${allViewerIds.size} users who have ever accessed the platform`);

    // ─── Find users with RECENT activity (within cutoff) ──────
    const recentViewerIds = new Set<string>();
    let recentOffset = 0;
    let recentHasMore = true;

    while (recentHasMore) {
      const { data: recentBatch, error: recentError } = await supabase
        .from("recipe_views")
        .select("user_id")
        .gte("viewed_at", cutoffISO)
        .range(recentOffset, recentOffset + BATCH_SIZE - 1);

      if (recentError) throw recentError;
      if (!recentBatch || recentBatch.length === 0) { recentHasMore = false; break; }

      for (const rv of recentBatch) recentViewerIds.add(rv.user_id);

      if (recentBatch.length < BATCH_SIZE) recentHasMore = false;
      else recentOffset += BATCH_SIZE;
    }

    console.log(`Found ${recentViewerIds.size} users with recent activity, ${adminIds.size} admins excluded`);

    // ─── Compute inactive user IDs: accessed before but not recently ──
    const inactiveViewerIds: string[] = [];
    for (const uid of allViewerIds) {
      if (!adminIds.has(uid) && !recentViewerIds.has(uid)) {
        inactiveViewerIds.push(uid);
      }
    }

    console.log(`Found ${inactiveViewerIds.length} inactive users who previously accessed the platform`);

    // ─── Fetch profiles only for inactive viewers (in batches) ──
    const allInactiveProfiles: any[] = [];
    const idBatches = chunk(inactiveViewerIds, 200);

    for (const idBatch of idBatches) {
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone")
        .in("user_id", idBatch);

      if (profError) throw profError;
      if (profiles) allInactiveProfiles.push(...profiles);
    }

    console.log(`Found ${allInactiveProfiles.length} total inactive non-admin users`);

    if (allInactiveProfiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No inactive users", pushSent: 0, emailsSent: 0, whatsappQueued: 0, totalInactive: 0, batchOffset: 0, hasMore: false }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── Batch limit: process only a slice per invocation ──────
    const PROCESS_LIMIT = 100;
    let processOffset = 0;
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      if (body2?.processOffset) processOffset = parseInt(body2.processOffset, 10) || 0;
    } catch { /* ignore */ }

    const profilesToProcess = allInactiveProfiles.slice(processOffset, processOffset + PROCESS_LIMIT);
    const processHasMore = (processOffset + PROCESS_LIMIT) < allInactiveProfiles.length;

    console.log(`Processing batch: offset=${processOffset}, count=${profilesToProcess.length}, hasMore=${processHasMore}`);

    if (profilesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No users in this batch", pushSent: 0, emailsSent: 0, whatsappQueued: 0, totalInactive: allInactiveProfiles.length, batchOffset: processOffset, hasMore: false }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const inactiveUserIds = profilesToProcess.map((p: any) => p.user_id);

    // ─── Push Notifications ───────────────────────────────────
    let pushSent = 0;
    const pushErrors: { endpoint: string; error: string }[] = [];

    if (hasVapid) {
      // Batch the .in() queries to avoid URL length limits
      const userIdBatches = chunk(inactiveUserIds, 200);
      for (const batch of userIdBatches) {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("*")
          .in("user_id", batch);

        const pushPayload = JSON.stringify({
          title: "📚 Seu curso está esperando por você",
          body: `Faz ${inactiveDays} dias que você não acessa suas aulas. Que tal revisar o conteúdo?`,
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
            pushErrors.push({ endpoint: sub.endpoint, error: err.message || String(err) });
          }
        }
      }
    }

    // ─── Email Notifications ──────────────────────────────────
    let emailsSent = 0;
    const emailErrors: { email: string; error: string }[] = [];

    const [settingsResult, templateResult] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "study-reminder").single(),
    ]);

    const senderName = settingsResult.data?.sender_name || "Drinkeros";
    const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = settingsResult.data?.reply_to_email || undefined;
    const subject = templateResult.data?.subject || "📚 Sentimos sua falta! Volte a estudar!";
    const htmlTemplate = templateResult.data?.html_body || "";

    if (htmlTemplate) {
      const loginUrl = "https://alunos.criminallab.com.br/login";

      for (const profile of profilesToProcess) {
        const userName = profile.full_name || profile.email.split("@")[0];

        let html = htmlTemplate
          .replaceAll("{{user_name}}", userName)
          .replaceAll("{{email}}", profile.email)
          .replaceAll("{{inactive_days}}", String(inactiveDays))
          .replaceAll("{{login_url}}", loginUrl);

        try {
          const result = await enqueueEmail(supabase, {
            to: profile.email,
            subject,
            html,
            label: "study-reminder",
            idempotencyKey: `study-reminder-${profile.user_id}-${new Date().toISOString().slice(0, 10)}`,
          });
          if (result.success) {
            emailsSent++;
          } else {
            emailErrors.push({ email: profile.email, error: result.error || "enqueue failed" });
          }
        } catch (err: any) {
          emailErrors.push({ email: profile.email, error: err.message || String(err) });
        }
      }
    } else {
      console.warn("No study-reminder email template found, skipping emails");
    }

    // ─── WhatsApp Notifications via Template Bindings ─────────
    let whatsappQueued = 0;
    const whatsappErrors: { phone: string; error: string }[] = [];

    try {
      const { data: studyBindings } = await supabase
        .from("whatsapp_template_bindings")
        .select("*")
        .eq("process", "study_reminder")
        .eq("is_active", true);

      if (studyBindings && studyBindings.length > 0) {
        // Business hours: 08:00-21:00 BRT (UTC-3)
        const now = new Date();
        const brtHour = (now.getUTCHours() - 3 + 24) % 24;
        let scheduledAt: string;

        if (brtHour >= 8 && brtHour < 21) {
          scheduledAt = now.toISOString();
        } else {
          const next8am = new Date(now);
          if (brtHour >= 21) next8am.setUTCDate(next8am.getUTCDate() + 1);
          next8am.setUTCHours(11, 0, 0, 0);
          scheduledAt = next8am.toISOString();
        }

        const loginUrl = "https://alunos.criminallab.com.br/login";
        const { data: connectionId } = await supabase.rpc("select_zapi_connection", {
          p_is_new_contact: true,
        });

        if (connectionId) {
          const bindingConnectionId = studyBindings[0].connection_id;

          // Calculate cooldown date (same as inactiveDays)
          const cooldownDate = new Date();
          cooldownDate.setDate(cooldownDate.getDate() - inactiveDays);

          for (const profile of profilesToProcess) {
            if (!profile.phone) continue;
            try {
              // ─── Deduplication: skip if already sent recently ───
              const { data: recentReminders } = await supabase
                .from("whatsapp_send_queue")
                .select("id")
                .eq("phone", profile.phone)
                .eq("context_type", "study_reminder")
                .gte("created_at", cooldownDate.toISOString())
                .limit(1);

              if (recentReminders && recentReminders.length > 0) {
                console.log(`[study-reminders] Skipping ${profile.phone} — already sent within ${inactiveDays} days`);
                continue;
              }
              const binding = studyBindings[Math.floor(Math.random() * studyBindings.length)];
              const userName = profile.full_name || profile.email.split("@")[0];

              const variableValues: Record<string, string> = {};
              const varMap = (binding.variable_map || {}) as Record<string, string>;
              for (const [templateVar, systemVar] of Object.entries(varMap)) {
                if (systemVar === "student_name") variableValues[templateVar] = userName;
                else if (systemVar === "login_url") variableValues[templateVar] = loginUrl;
              }

              const message = JSON.stringify({
                type: "template",
                template_name: binding.template_name,
                variable_map: varMap,
                variables: variableValues,
              });

              await supabase.from("whatsapp_send_queue").insert({
                phone: profile.phone,
                message,
                context_type: "study_reminder",
                priority: 3,
                context_data: { user_id: profile.user_id, binding_id: binding.id },
                scheduled_at: scheduledAt,
                zapi_connection_id: bindingConnectionId,
              });
              whatsappQueued++;
            } catch (err: any) {
              whatsappErrors.push({ phone: profile.phone, error: err.message || String(err) });
            }
          }
        } else {
          console.warn("No active WhatsApp connection for study reminders");
        }
      } else {
        console.log("No active study_reminder bindings, skipping WhatsApp");
      }
    } catch (err: any) {
      console.error("Error queuing WhatsApp study reminders:", err);
    }

    console.log(`WhatsApp study reminders queued: ${whatsappQueued}`);

    // ─── Log the reminder ─────────────────────────────────────
    await supabase.from("notifications").insert({
      title: "📚 Seu curso está esperando por você",
      body: `Lembrete automático (lote ${processOffset}-${processOffset + profilesToProcess.length}/${allInactiveProfiles.length}): Push: ${pushSent}, Email: ${emailsSent}, WhatsApp: ${whatsappQueued}.`,
      url: "/app",
      target_type: "study_reminder",
      target_user_ids: inactiveUserIds,
      sent_count: pushSent + emailsSent + whatsappQueued,
      sent_by: "00000000-0000-0000-0000-000000000000",
    });

    // ─── Timeline events ──────────────────────────────────────
    try {
      const timelineInserts = profilesToProcess.map((p: any) => ({
        event_type: "study_reminder",
        event_subtype: "sent",
        user_id: p.user_id,
        phone: p.phone || null,
        channel: "push",
        summary: `Reforço de estudo (${inactiveDays}d inativo) enviado para ${p.full_name || p.email}`,
        metadata: { inactive_days: inactiveDays, push: pushSent > 0, email: emailsSent > 0, whatsapp: whatsappQueued > 0 },
      }));
      for (let ti = 0; ti < timelineInserts.length; ti += 50) {
        await supabase.from("cs_timeline_events").insert(timelineInserts.slice(ti, ti + 50));
      }
    } catch (tlErr: any) {
      console.error("Timeline insert error:", tlErr.message);
    }

    console.log(`Study reminders: push=${pushSent}, email=${emailsSent}, whatsapp=${whatsappQueued}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalInactive: allInactiveProfiles.length,
        batchProcessed: profilesToProcess.length,
        batchOffset: processOffset,
        hasMore: processHasMore,
        nextOffset: processHasMore ? processOffset + PROCESS_LIMIT : null,
        pushSent,
        emailsSent,
        whatsappQueued,
        pushErrors: pushErrors.length > 0 ? pushErrors.slice(0, 10) : undefined,
        emailErrors: emailErrors.length > 0 ? emailErrors.slice(0, 10) : undefined,
        whatsappErrors: whatsappErrors.length > 0 ? whatsappErrors.slice(0, 10) : undefined,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending study reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
