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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional body
    let forceRun = false;
    try {
      const body = await req.json();
      if (body?.forceRun) forceRun = true;
    } catch { /* no body */ }

    // ─── 1. Find enrollments between 24h and 48h ago ───────────
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    console.log(`[onboarding-followup] Looking for enrollments between ${cutoff48h.toISOString()} and ${cutoff24h.toISOString()}`);

    // Get all recent enrollments from user_packages, user_courses, user_combos
    const [{ data: pkgEnrollments }, { data: courseEnrollments }, { data: comboEnrollments }] = await Promise.all([
      supabase.from("user_packages").select("user_id, purchased_at").gte("purchased_at", cutoff48h.toISOString()).lte("purchased_at", cutoff24h.toISOString()),
      supabase.from("user_courses").select("user_id, purchased_at").gte("purchased_at", cutoff48h.toISOString()).lte("purchased_at", cutoff24h.toISOString()),
      supabase.from("user_combos").select("user_id, purchased_at").gte("purchased_at", cutoff48h.toISOString()).lte("purchased_at", cutoff24h.toISOString()),
    ]);

    // Unique user IDs with earliest enrollment
    const userEnrollments = new Map<string, string>();
    for (const e of [...(pkgEnrollments || []), ...(courseEnrollments || []), ...(comboEnrollments || [])]) {
      const existing = userEnrollments.get(e.user_id);
      if (!existing || e.purchased_at < existing) {
        userEnrollments.set(e.user_id, e.purchased_at);
      }
    }

    const candidateUserIds = Array.from(userEnrollments.keys());
    console.log(`[onboarding-followup] Found ${candidateUserIds.length} users enrolled in 24-48h window`);

    if (candidateUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No enrollments in window", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Exclude already notified ───────────────────────────
    const { data: alreadyNotified } = await supabase
      .from("onboarding_followup_logs")
      .select("user_id")
      .in("user_id", candidateUserIds);
    const notifiedSet = new Set((alreadyNotified || []).map((r: any) => r.user_id));

    // Exclude admins
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "editor"]);
    const adminSet = new Set((adminRoles || []).map((r: any) => r.user_id));

    const filteredUserIds = candidateUserIds.filter((uid) => !notifiedSet.has(uid) && !adminSet.has(uid));
    console.log(`[onboarding-followup] After excluding notified/admins: ${filteredUserIds.length} candidates`);

    if (filteredUserIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "All candidates already notified or admin", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 3. Check login status via auth ────────────────────────
    const eligibleUsers: { userId: string; email: string; fullName: string | null; phone: string | null; enrolledAt: string }[] = [];

    // Get profiles for these users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, phone")
      .in("user_id", filteredUserIds);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No profiles found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check each user's last_sign_in_at
    for (const profile of profiles) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(profile.user_id);
        const enrolledAt = userEnrollments.get(profile.user_id)!;
        
        // User never logged in, or last login was before enrollment
        if (!user?.last_sign_in_at || new Date(user.last_sign_in_at) < new Date(enrolledAt)) {
          eligibleUsers.push({
            userId: profile.user_id,
            email: profile.email,
            fullName: profile.full_name,
            phone: profile.phone,
            enrolledAt,
          });
        }
      } catch (err) {
        console.error(`[onboarding-followup] Error checking user ${profile.user_id}:`, err);
      }
    }

    console.log(`[onboarding-followup] ${eligibleUsers.length} users eligible (no login after enrollment)`);

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "All users already logged in", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 4. Send WhatsApp templates ────────────────────────────
    let whatsappSent = 0;
    const whatsappErrors: { phone: string; error: string }[] = [];
    const sentPhones = new Set<string>(); // Prevent duplicate sends

    // Get an active Era Cloud connection
    const { data: eraConn } = await supabase
      .from("zapi_connections")
      .select("id, token, api_url, phone_number")
      .eq("is_active", true)
      .eq("provider", "era_cloud")
      .limit(1)
      .single();

    for (const user of eligibleUsers) {
      if (!user.phone || !eraConn) {
        whatsappErrors.push({ phone: user.phone || "sem telefone", error: "No phone or no connection" });
        continue;
      }

      const phone = normalizePhone(user.phone);
      if (sentPhones.has(phone)) {
        console.warn(`[onboarding-followup] Skipping duplicate phone ${phone}`);
        continue;
      }

      try {
        const firstName = user.fullName?.split(" ")[0] || "aluno(a)";

        // Resolve template binding for onboarding_followup
        const { data: allBindings } = await supabase
          .from("whatsapp_template_bindings")
          .select("template_name, variable_map")
          .eq("connection_id", eraConn.id)
          .eq("process", FOLLOWUP_PROCESS)
          .eq("is_active", true);

        const binding = allBindings && allBindings.length > 0
          ? allBindings[Math.floor(Math.random() * allBindings.length)]
          : null;

        if (!binding) {
          console.warn(`[onboarding-followup] No template binding for process '${FOLLOWUP_PROCESS}', skipping WhatsApp for ${phone}`);
          whatsappErrors.push({ phone, error: `No template binding for ${FOLLOWUP_PROCESS}` });
          continue;
        }

        // Build parameters from variable_map
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

        // Send template via Era Cloud
        const templateRes = await fetch(`${eraConn.api_url}/v1/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": eraConn.token! },
          body: JSON.stringify({
            to: phone,
            type: "template",
            template: {
              name: binding.template_name,
              language: { code: "pt_BR" },
              components: parameters.length > 0
                ? [{ type: "body", parameters: parameters.map((p: string) => ({ type: "text", text: p })) }]
                : [],
            },
          }),
        });

        if (!templateRes.ok) {
          const errData = await templateRes.json();
          throw new Error(`Template error [${templateRes.status}]: ${JSON.stringify(errData)}`);
        }

        const resData = await templateRes.json();
        const messageId = resData.messages?.[0]?.id || null;

        // Render template body for display
        const { data: tplData } = await supabase
          .from("whatsapp_templates")
          .select("components")
          .eq("connection_id", eraConn.id)
          .eq("name", binding.template_name)
          .maybeSingle();

        let templateBody = "";
        if (tplData?.components && Array.isArray(tplData.components)) {
          const bodyComp = (tplData.components as any[]).find((c: any) => c.type === "BODY");
          if (bodyComp?.text) {
            templateBody = bodyComp.text;
            parameters.forEach((val: string, idx: number) => {
              templateBody = templateBody.replace(`{{${idx + 1}}}`, val);
            });
          }
        }

        // Find or create conversation
        const profileForConv = profiles!.find((p: any) => p.user_id === user.userId);
        let { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("id")
          .or(`phone.eq.${phone},phone.eq.+${phone}`)
          .maybeSingle();

        if (!conv) {
          const { data: newConv } = await supabase
            .from("whatsapp_conversations")
            .insert({
              phone,
              contact_name: firstName,
              profile_id: profileForConv?.user_id || null,
              status: "open",
              agent_mode: "ai",
              zapi_connection_id: eraConn.id,
              last_message_at: new Date().toISOString(),
              last_message_preview: templateBody?.substring(0, 100) || `[Template ${binding.template_name}]`,
            })
            .select("id")
            .single();
          conv = newConv;
        } else {
          await supabase.from("whatsapp_conversations").update({
            last_message_at: new Date().toISOString(),
            last_message_preview: templateBody?.substring(0, 100) || `[Template ${binding.template_name}]`,
            zapi_connection_id: eraConn.id,
            profile_id: profileForConv?.user_id || undefined,
          }).eq("id", conv.id);
        }

        if (conv) {
          await supabase.from("whatsapp_messages").insert({
            conversation_id: conv.id,
            direction: "outbound",
            message_type: "template",
            content: `[Template ${binding.template_name}] ${parameters.join(", ")}`,
            zapi_message_id: messageId,
            status: "sent",
            metadata: {
              source: "onboarding_followup",
              template_name: binding.template_name,
              template_body: templateBody || undefined,
              ...(templateBody ? {} : {}),
            },
          });
        }

        whatsappSent++;
        sentPhones.add(phone);
        console.log(`[onboarding-followup] WhatsApp template sent to ${phone}`);
      } catch (err: any) {
        console.error(`[onboarding-followup] WhatsApp error for ${user.phone}:`, err);
        whatsappErrors.push({ phone: user.phone || "", error: err.message });
      }
    }

    // ─── 5. Send emails ────────────────────────────────────────
    let emailsSent = 0;
    const emailErrors: { email: string; error: string }[] = [];

    const [settingsResult, templateResult] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "onboarding-followup").maybeSingle(),
    ]);

    const senderName = settingsResult.data?.sender_name || "Drinkeros";
    const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = settingsResult.data?.reply_to_email || undefined;
    const subject = templateResult.data?.subject || "👋 Precisa de ajuda para acessar?";
    const htmlTemplate = templateResult.data?.html_body || DEFAULT_EMAIL_HTML;

    for (const user of eligibleUsers) {
      try {
        const userName = user.fullName?.split(" ")[0] || user.email.split("@")[0];
        const html = htmlTemplate
          .replaceAll("{{user_name}}", userName)
          .replaceAll("{{email}}", user.email)
          .replaceAll("{{login_url}}", LOGIN_URL);

        await sendEmailViaSES({
          from: `${senderName} <${senderEmail}>`,
          to: [user.email],
          subject,
          html,
          replyTo,
        });
        emailsSent++;
      } catch (err: any) {
        emailErrors.push({ email: user.email, error: err.message });
      }
    }

    // ─── 6. Log follow-ups ─────────────────────────────────────
    for (const user of eligibleUsers) {
      await supabase.from("onboarding_followup_logs").upsert({
        user_id: user.userId,
        phone: user.phone,
        email: user.email,
        whatsapp_sent: whatsappErrors.every((e) => e.phone !== user.phone),
        email_sent: emailErrors.every((e) => e.email !== user.email),
      }, { onConflict: "user_id" });
    }

    console.log(`[onboarding-followup] Done: WhatsApp=${whatsappSent}, Email=${emailsSent}`);

    return new Response(JSON.stringify({
      success: true,
      eligible: eligibleUsers.length,
      whatsappSent,
      emailsSent,
      whatsappErrors: whatsappErrors.length > 0 ? whatsappErrors : undefined,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[onboarding-followup] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
