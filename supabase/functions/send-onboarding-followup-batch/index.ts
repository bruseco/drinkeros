import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses@3.485.0";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGIN_URL = "https://alunos.criminallab.com.br/login";
const FOLLOWUP_PROCESS = "onboarding_followup";
const ENROLLMENT_CUTOFF = "2026-02-15T23:59:59+00:00";

const sesClient = new SESClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

async function sendEmailViaSES(params: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const command = new SendEmailCommand({
    Source: params.from,
    Destination: { ToAddresses: params.to },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: { Html: { Data: params.html, Charset: "UTF-8" } },
    },
    ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
    Tags: [{ Name: "email_type", Value: "transactional" }],
  });
  return sesClient.send(command);
}

const DEFAULT_EMAIL_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0a; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; color: #f5f5f5;">
    <h1 style="color: #dc2626;">Oi, {{user_name}}! 👋</h1>
    <p>Notamos que você se matriculou mas ainda não acessou a plataforma.</p>
    <p>Está tudo bem? Precisa de alguma ajuda para acessar?</p>
    <p>Seus cursos estão te esperando! É só clicar no botão abaixo:</p>
    <a href="{{login_url}}" style="background:#dc2626;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;font-weight:bold;">Acessar minha conta</a>
    <p style="margin-top: 24px; font-size: 14px; color: #aaa;">Se tiver qualquer dificuldade, responda este e-mail que te ajudamos! 😊</p>
  </div>
</body></html>`;

// Helper to fetch all rows from a table with pagination
async function fetchAllRows(supabase: any, table: string, selectFields: string, filters?: { field: string; op: string; value: string }[]): Promise<any[]> {
  const allRows: any[] = [];
  const pageSize = 1000;
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

/**
 * Calculate scheduled_at for batched sending: 100 contacts per hour, 8h-21h BRT (UTC-3)
 */
function calculateScheduledAt(index: number, now: Date): string {
  const brtOffset = -3;
  const brtNow = new Date(now.getTime() + brtOffset * 60 * 60 * 1000);
  const brtHour = brtNow.getUTCHours();

  // Determine starting hour
  let startDate = new Date(brtNow);
  if (brtHour < 8) {
    startDate.setUTCHours(8, 0, 0, 0);
  } else if (brtHour >= 21) {
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    startDate.setUTCHours(8, 0, 0, 0);
  }

  // Each batch of 100 advances 1 hour
  const batchNumber = Math.floor(index / 100);
  const scheduledBrt = new Date(startDate.getTime() + batchNumber * 60 * 60 * 1000);

  // If exceeds 21h, move to next day at 8h
  let scheduledBrtHour = scheduledBrt.getUTCHours();
  if (scheduledBrtHour >= 21) {
    const extraHours = scheduledBrtHour - 21;
    scheduledBrt.setUTCDate(scheduledBrt.getUTCDate() + 1);
    scheduledBrt.setUTCHours(8 + extraHours, 0, 0, 0);
  }

  // Convert back to UTC
  const utcScheduled = new Date(scheduledBrt.getTime() - brtOffset * 60 * 60 * 1000);
  return utcScheduled.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse parameters
    let batchSize = 20;
    let offset = 0;
    let dryRun = false;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(Math.max(1, body.batch_size), 100);
      if (body?.offset != null) offset = Math.max(0, body.offset);
      if (body?.dry_run != null) dryRun = body.dry_run;
    } catch { /* no body */ }

    console.log(`[batch-followup] batch_size=${batchSize}, offset=${offset}, dry_run=${dryRun}`);

    // ─── 1. Get ALL enrolled user IDs with date filter ───
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
    console.log(`[batch-followup] Total enrolled users (until ${ENROLLMENT_CUTOFF}): ${enrolledUserIds.size}`);

    // ─── 2. Exclude admins/editors ───
    const adminRoles = await fetchAllRows(supabase, "user_roles", "user_id, role");
    const adminSet = new Set(
      adminRoles
        .filter((r: any) => r.role === "super_admin" || r.role === "editor")
        .map((r: any) => r.user_id)
    );

    // ─── 3. Exclude already notified ───
    const alreadyNotified = await fetchAllRows(supabase, "onboarding_followup_logs", "user_id");
    const notifiedSet = new Set(alreadyNotified.map((r: any) => r.user_id));

    // ─── 4. Exclude users who have ANY recipe_views (already accessed) ───
    const viewedUsers = await fetchAllRows(supabase, "recipe_views", "user_id");
    const viewedSet = new Set(viewedUsers.map((r: any) => r.user_id));

    // ─── 5. Filter eligible ───
    const eligibleUserIds = Array.from(enrolledUserIds).filter(
      (uid) => !adminSet.has(uid) && !notifiedSet.has(uid) && !viewedSet.has(uid)
    );

    console.log(`[batch-followup] Eligible (no views, not notified, not admin): ${eligibleUserIds.length}`);

    // ─── 6. Get profiles for eligible users (including those WITHOUT phone) ───
    const profileChunks: any[] = [];
    for (let i = 0; i < eligibleUserIds.length; i += 50) {
      const chunk = eligibleUserIds.slice(i, i + 50);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, phone")
        .in("user_id", chunk);
      if (error) {
        console.error(`[batch-followup] Profile chunk ${i / 50 + 1} error:`, error.message);
      }
      if (data) profileChunks.push(...data);
    }

    // Deduplicate by user_id
    const seenUserIds = new Set<string>();
    const uniqueProfiles: any[] = [];
    for (const p of profileChunks) {
      if (!seenUserIds.has(p.user_id)) {
        seenUserIds.add(p.user_id);
        uniqueProfiles.push(p);
      }
    }

    uniqueProfiles.sort((a: any, b: any) => a.user_id.localeCompare(b.user_id));

    const totalEligible = uniqueProfiles.length;
    console.log(`[batch-followup] Eligible profiles (with or without phone): ${totalEligible}`);

    // Apply offset and batch_size
    const batch = uniqueProfiles.slice(offset, offset + batchSize);
    const remaining = Math.max(0, totalEligible - offset - batchSize);

    if (dryRun) {
      const withPhone = uniqueProfiles.filter((p: any) => p.phone).length;
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        total_eligible: totalEligible,
        total_with_phone: withPhone,
        total_email_only: totalEligible - withPhone,
        batch_size: batchSize,
        offset,
        batch_count: batch.length,
        remaining,
        sample: batch.slice(0, 10).map((p: any) => ({
          user_id: p.user_id,
          name: p.full_name,
          phone: p.phone || "(sem telefone)",
          email: p.email,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (batch.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        total_eligible: totalEligible,
        batch_size: batchSize,
        offset,
        sent: 0,
        errors: 0,
        remaining: 0,
        message: "No users in this batch range",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 7. Get Era Cloud connection (for WhatsApp queue) ───
    const { data: eraConn } = await supabase
      .from("zapi_connections")
      .select("id, token, api_url, phone_number")
      .eq("is_active", true)
      .eq("provider", "era_cloud")
      .limit(1)
      .maybeSingle();

    // ─── 8. Get template binding (for WhatsApp) ───
    let allBindings: any[] | null = null;
    if (eraConn) {
      const { data } = await supabase
        .from("whatsapp_template_bindings")
        .select("template_name, variable_map")
        .eq("connection_id", eraConn.id)
        .eq("process", FOLLOWUP_PROCESS)
        .eq("is_active", true);
      allBindings = data;
    }

    // ─── 9. Fetch email settings and template ───
    const [settingsResult, templateResult] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "onboarding-followup").maybeSingle(),
    ]);

    const senderName = settingsResult.data?.sender_name || "Criminal Lab";
    const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = settingsResult.data?.reply_to_email || undefined;
    const emailSubject = templateResult.data?.subject || "👋 Precisa de ajuda para acessar?";
    const htmlTemplate = templateResult.data?.html_body || DEFAULT_EMAIL_HTML;

    // ─── 10. Process each user: WhatsApp via Queue + Email direct ───
    let waQueued = 0;
    let emailSent = 0;
    let errors = 0;
    const errorDetails: { phone: string; error: string }[] = [];
    const now = new Date();
    let queueIndex = 0; // Global index for scheduling calculation

    for (const profile of batch) {
      let waSuccess = false;
      let emailSuccess = false;

      // --- WhatsApp: enqueue instead of sending directly ---
      if (profile.phone && eraConn && allBindings && allBindings.length > 0) {
        const phone = normalizePhone(profile.phone);

        try {
          const firstName = profile.full_name?.split(" ")[0] || "aluno(a)";
          const binding = allBindings[Math.floor(Math.random() * allBindings.length)];
          const varMap = (binding.variable_map || {}) as Record<string, string>;
          const variableValues: Record<string, string> = {
            student_name: firstName,
            login_url: LOGIN_URL,
          };
          const maxIdx = Object.keys(varMap).length > 0
            ? Math.max(...Object.keys(varMap).map(Number))
            : 0;
          const parameters: string[] = [];
          for (let i = 1; i <= maxIdx; i++) {
            const sysVar = varMap[String(i)] || "";
            parameters.push(variableValues[sysVar] || "");
          }

          const message = JSON.stringify({
            type: "template",
            template_name: binding.template_name,
            variable_map: varMap,
            variables: variableValues,
          });

          const scheduledAt = calculateScheduledAt(queueIndex, now);

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

          waSuccess = true;
          waQueued++;
          queueIndex++;
          console.log(`[batch-followup] WhatsApp queued for ${phone} (scheduled: ${scheduledAt})`);

          // Timeline event
          await supabase.from("cs_timeline_events").insert({
            event_type: "onboarding_followup",
            event_subtype: "queued",
            user_id: profile.user_id,
            phone,
            channel: "whatsapp",
            summary: `Onboarding followup enfileirado para ${firstName} (${phone})`,
            metadata: { template_name: binding.template_name, scheduled_at: scheduledAt },
          });
        } catch (err: any) {
          errorDetails.push({ phone: profile.phone, error: `WhatsApp queue: ${err.message}` });
          console.error(`[batch-followup] WhatsApp queue error for ${profile.phone}:`, err.message);
        }
      }

      // --- Email (always, for all users) ---
      try {
        const userName = profile.full_name?.split(" ")[0] || profile.email?.split("@")[0] || "aluno(a)";
        const html = htmlTemplate
          .replaceAll("{{user_name}}", userName)
          .replaceAll("{{email}}", profile.email || "")
          .replaceAll("{{login_url}}", LOGIN_URL);

        await sendEmailViaSES({
          from: `${senderName} <${senderEmail}>`,
          to: [profile.email],
          subject: emailSubject,
          html,
          replyTo,
        });

        emailSuccess = true;
        emailSent++;
        console.log(`[batch-followup] Email sent to ${profile.email}`);

        // Timeline event for email
        await supabase.from("cs_timeline_events").insert({
          event_type: "onboarding_followup",
          event_subtype: "sent",
          user_id: profile.user_id,
          phone: profile.phone || null,
          channel: "email",
          summary: `Email de onboarding enviado para ${profile.email}`,
          metadata: { email: profile.email },
        });
      } catch (err: any) {
        errorDetails.push({ phone: profile.email, error: `Email: ${err.message}` });
        console.error(`[batch-followup] Email error for ${profile.email}:`, err.message);
      }

      // --- Log ---
      await supabase.from("onboarding_followup_logs").upsert({
        user_id: profile.user_id,
        phone: profile.phone,
        email: profile.email,
        whatsapp_sent: waSuccess,
        email_sent: emailSuccess,
      }, { onConflict: "user_id" });

      if (!waSuccess && !emailSuccess) {
        errors++;
      }

      // Small delay to avoid rate limiting on email
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[batch-followup] Done: wa_queued=${waQueued}, email=${emailSent}, errors=${errors}, remaining=${remaining}`);

    return new Response(JSON.stringify({
      success: true,
      total_eligible: totalEligible,
      batch_size: batchSize,
      offset,
      sent: waQueued + emailSent,
      whatsapp_queued: waQueued,
      email_sent: emailSent,
      errors,
      remaining,
      error_details: errorDetails.length > 0 ? errorDetails : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[batch-followup] Fatal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
