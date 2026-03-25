import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses@3.485.0";

const sesClient = new SESClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CS_SYSTEM_PROMPT = `Você é o gerente de Customer Success da Criminal Lab, uma plataforma de cursos online de Direito Criminal.

Sua tarefa é analisar as métricas operacionais fornecidas e gerar um relatório diário conciso e acionável.

REGRAS:
1. Classifique o status geral como: "ok", "warning" ou "critical"
2. Use formato de texto simples com emojis para facilitar leitura
3. Destaque problemas que precisam de ação imediata
4. Inclua recomendações específicas quando houver problemas
5. Seja direto e objetivo, máximo 2000 caracteres
6. Responda APENAS com um JSON válido no formato:
{
  "status": "ok|warning|critical",
  "report_text": "texto do relatório",
  "alerts": ["alerta1", "alerta2"]
}

SEÇÃO DE RETENÇÃO:
- Analise a seção "retencao" do JSON com atenção especial
- Dê recomendações específicas sobre engajamento dos alunos
- Destaque tendências preocupantes de inatividade ou baixa conclusão

SEÇÃO CRM (RECUPERAÇÃO DE VENDAS):
- Analise a seção "crm" com atenção
- Destaque a taxa de conversão e perda de leads
- Se houver "leads_com_matricula_nao_convertidos" > 0, alerte como anomalia a ser corrigida
- Recomende ações para leads estagnados em estágios de recuperação

CRITÉRIOS DE CLASSIFICAÇÃO:
- ok: Todos os processos funcionando normalmente, taxa de conclusão ≥20%, taxa de inatividade ≤30%
- warning: Métricas fora do normal (>30% inativos, fila com falhas, crons atrasados, taxa de conclusão <20%, taxa de inatividade >50%, leads_com_matricula_nao_convertidos > 0)
- critical: Processos travados, conexões offline, itens na fila >72h sem processar, taxa de inatividade >70%, tempo médio entre acessos >10 dias`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- Collect all metrics in parallel ----
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      pendingWelcome,
      stuckItems,
      connections,
      failedQueue,
      processingQueue,
      lastStudyReminder,
      lastOnboardingReminder,
      activeUpsell,
      upsellLogsToday,
      openConversations,
      reopensToday,
      retentionResult,
      // CRM metrics
      crmLeadsActive,
      crmLeadsConverted7d,
      crmLeadsLost7d,
      crmLeadsByStage,
    ] = await Promise.all([
      // Welcome Queue pendentes (processed mas sem credentials_sent)
      adminClient
        .from("whatsapp_welcome_queue")
        .select("id", { count: "exact", head: true })
        .eq("processed", true)
        .eq("credentials_sent", false),

      // Itens travados (>72h sem credentials_sent)
      adminClient
        .from("whatsapp_welcome_queue")
        .select("id", { count: "exact", head: true })
        .eq("credentials_sent", false)
        .lt("created_at", seventyTwoHoursAgo),

      // Conexoes WhatsApp
      adminClient
        .from("zapi_connections")
        .select("name, connection_status, is_active, provider"),

      // Fila falhas
      adminClient
        .from("whatsapp_send_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),

      // Fila processing (possivelmente travada)
      adminClient
        .from("whatsapp_send_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing"),

      // Ultimo study reminder
      adminClient
        .from("notifications")
        .select("created_at")
        .eq("target_type", "study_reminder")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Ultimo onboarding reminder
      adminClient
        .from("notifications")
        .select("created_at")
        .eq("target_type", "onboarding_reminder")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Upsell sequences ativas
      adminClient
        .from("upsell_sequences")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // Upsell logs de hoje
      adminClient
        .from("upsell_email_logs")
        .select("id, channel", { count: "exact" })
        .gte("sent_at", todayStart),

      // Conversas abertas
      adminClient
        .from("whatsapp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),

      // Reopens de hoje
      adminClient
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .gte("created_at", todayStart),

      // All retention metrics via DB function (bypasses 1000 row limit)
      adminClient.rpc("get_retention_metrics", {
        p_seven_days_ago: sevenDaysAgo,
        p_thirty_days_ago: thirtyDaysAgo,
      }),

      // CRM: total leads ativos
      adminClient.from("crm_leads").select("id", { count: "exact", head: true })
        .not("stage", "in", "(convertido,perdido)"),

      // CRM: convertidos nos últimos 7 dias
      adminClient.from("crm_leads").select("id", { count: "exact", head: true })
        .eq("stage", "convertido")
        .gte("converted_at", sevenDaysAgo),

      // CRM: perdidos nos últimos 7 dias
      adminClient.from("crm_leads").select("id", { count: "exact", head: true })
        .eq("stage", "perdido")
        .gte("updated_at", sevenDaysAgo),

      // CRM: leads por estágio
      adminClient.from("crm_leads").select("stage")
        .not("stage", "in", "(convertido,perdido)"),
    ]);

    // ---- Retention metrics from RPC ----
    const retention = retentionResult.data || {};
    const totalStudents = retention.total_students || 0;
    const activeStudentsCount = retention.active_students_7d || 0;
    const inactiveCount = Math.max(0, totalStudents - activeStudentsCount);
    const inactivityRate = totalStudents > 0 ? Math.round((inactiveCount / totalStudents) * 100) : 0;
    const completedCount = retention.completed_views_7d || 0;
    const totalViewsCount = retention.total_views_7d || 0;
    const completionRate = totalViewsCount > 0 ? Math.round((completedCount / totalViewsCount) * 100) : 0;
    const avgDaysBetweenAccess = retention.avg_days_between_access || 0;
    const newUsers7d = retention.new_users_7d || 0;
    const usersWithoutAccess = retention.new_users_without_access_7d || 0;

    // Count upsell logs by channel
    const upsellEmailsToday = (upsellLogsToday.data || []).filter((l) => l.channel === "email").length;
    const upsellWhatsappToday = (upsellLogsToday.data || []).filter((l) => l.channel === "whatsapp").length;

    // CRM: count by stage
    const stageCounts: Record<string, number> = {};
    for (const lead of (crmLeadsByStage.data || [])) {
      stageCounts[lead.stage] = (stageCounts[lead.stage] || 0) + 1;
    }

    // CRM: detect anomaly - leads with email that have enrollments but not marked as converted
    let leadsWithEnrollmentNotConverted = 0;
    try {
      const activeLeadsWithEmail = (crmLeadsByStage.data || []).slice(0, 50); // sample
      // We already have active leads, check a batch for enrollment
      if (activeLeadsWithEmail.length > 0) {
        const { data: activeLeadsFull } = await adminClient.from("crm_leads")
          .select("id, email")
          .not("stage", "in", "(convertido,perdido)")
          .not("email", "is", null)
          .limit(200);
        const emails = (activeLeadsFull || []).map((l: any) => l.email).filter(Boolean);
        if (emails.length > 0) {
          const { data: enrolledProfiles } = await adminClient.from("profiles")
            .select("email")
            .in("email", emails);
          const enrolledEmails = new Set((enrolledProfiles || []).map((p: any) => p.email));
          for (const lead of (activeLeadsFull || [])) {
            if (lead.email && enrolledEmails.has(lead.email)) {
              // Check if this profile actually has enrollments
              const { data: profile } = await adminClient.from("profiles").select("user_id").eq("email", lead.email).maybeSingle();
              if (profile) {
                const { count } = await adminClient.from("user_packages").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id);
                if ((count || 0) > 0) leadsWithEnrollmentNotConverted++;
              }
            }
          }
        }
      }
    } catch (anomalyErr) {
      console.error("CRM anomaly check error:", anomalyErr);
    }

    const metrics = {
      data_relatorio: now.toISOString().split("T")[0],
      welcome_queue: {
        pendentes_sem_credenciais: pendingWelcome.count || 0,
        travados_mais_72h: stuckItems.count || 0,
      },
      usuarios: {
        novos_7_dias: newUsers7d,
        sem_acesso_7_dias: usersWithoutAccess,
        percentual_sem_acesso: newUsers7d > 0
          ? Math.round((usersWithoutAccess / newUsers7d) * 100)
          : 0,
      },
      retencao: {
        total_alunos: totalStudents,
        alunos_ativos_7d: activeStudentsCount,
        alunos_inativos_7d: inactiveCount,
        taxa_inatividade_percentual: inactivityRate,
        aulas_visualizadas_7d: totalViewsCount,
        aulas_concluidas_7d: completedCount,
        taxa_conclusao_percentual: completionRate,
        tempo_medio_entre_acessos_dias: avgDaysBetweenAccess,
      },
      whatsapp: {
        conexoes: (connections.data || []).map((c) => ({
          nome: c.name,
          status: c.connection_status,
          ativo: c.is_active,
          provider: c.provider,
        })),
        conexoes_offline: (connections.data || []).filter(
          (c) => c.connection_status === "disconnected" || !c.is_active
        ).length,
        fila_falhas: failedQueue.count || 0,
        fila_processing: processingQueue.count || 0,
        conversas_abertas: openConversations.count || 0,
        mensagens_recebidas_hoje: reopensToday.count || 0,
      },
      reminders: {
        ultimo_study_reminder: lastStudyReminder.data?.created_at || "nunca",
        ultimo_onboarding_reminder: lastOnboardingReminder.data?.created_at || "nunca",
      },
      upsell: {
        sequences_ativas: activeUpsell.count || 0,
        emails_enviados_hoje: upsellEmailsToday,
        whatsapp_enviados_hoje: upsellWhatsappToday,
      },
      crm: {
        total_leads_ativos: crmLeadsActive.count || 0,
        por_estagio: stageCounts,
        convertidos_7d: crmLeadsConverted7d.count || 0,
        perdidos_7d: crmLeadsLost7d.count || 0,
        leads_com_matricula_nao_convertidos: leadsWithEnrollmentNotConverted,
      },
    };

    console.log("Metrics collected:", JSON.stringify(metrics));

    // ---- Call Gemini 3 Pro ----
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: CS_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(metrics) },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    console.log("AI raw response:", rawContent);

    // Parse the JSON response from the AI
    let reportData: { status: string; report_text: string; alerts: string[] };
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      reportData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response, using raw text:", parseError);
      reportData = {
        status: "warning",
        report_text: rawContent,
        alerts: ["Falha ao processar resposta estruturada da IA"],
      };
    }

    // ---- Save report ----
    const { data: report, error: insertError } = await adminClient
      .from("cs_reports")
      .insert({
        report_date: now.toISOString().split("T")[0],
        report_text: reportData.report_text,
        metrics: metrics,
        alerts: reportData.alerts || [],
        status: reportData.status || "ok",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving report:", insertError);
      throw insertError;
    }

    console.log("Report saved:", report.id);

    // ---- Send critical alert email to super_admins ----
    if (reportData.status === "critical") {
      try {
        const [{ data: adminUsers }, { data: emailSettings }] = await Promise.all([
          adminClient.from("user_roles").select("user_id").eq("role", "super_admin"),
          adminClient.from("email_settings").select("sender_email, sender_name, reply_to_email").limit(1).maybeSingle(),
        ]);

        const adminIds = (adminUsers || []).map((u: { user_id: string }) => u.user_id);

        if (adminIds.length > 0) {
          const { data: adminProfiles } = await adminClient
            .from("profiles")
            .select("email")
            .in("user_id", adminIds);

          const adminEmails = (adminProfiles || []).map((p: { email: string }) => p.email).filter(Boolean);

          if (adminEmails.length > 0) {
            const senderEmail = emailSettings?.sender_email || "noreply@poderdelconocimiento.com";
            const senderName = emailSettings?.sender_name || "Criminal Lab";
            const replyTo = emailSettings?.reply_to_email;
            const reportDate = now.toISOString().split("T")[0];

            const alertsHtml = (reportData.alerts || [])
              .map((a: string) => `<li style="color:#dc2626;margin-bottom:4px;">${a}</li>`)
              .join("");

            const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#dc2626;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">⚠️ ALERTA CRÍTICO - Agente CS</h1>
    <p style="margin:4px 0 0;font-size:14px;">Relatório de ${reportDate}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    ${alertsHtml ? `<h2 style="font-size:16px;color:#dc2626;">Alertas</h2><ul style="padding-left:20px;">${alertsHtml}</ul>` : ""}
    <h2 style="font-size:16px;color:#374151;">Relatório Completo</h2>
    <pre style="background:#f9fafb;padding:16px;border-radius:6px;white-space:pre-wrap;font-size:13px;">${reportData.report_text}</pre>
    <p style="margin-top:24px;"><a href="https://criminallab.lovable.app/admin/cs-reports" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Ver no Painel</a></p>
  </div>
</body>
</html>`;

            const command = new SendEmailCommand({
              Source: `${senderName} <${senderEmail}>`,
              Destination: { ToAddresses: adminEmails },
              Message: {
                Subject: { Data: `⚠️ ALERTA CRÍTICO - Relatório CS ${reportDate}`, Charset: "UTF-8" },
                Body: { Html: { Data: htmlBody, Charset: "UTF-8" } },
              },
              ReplyToAddresses: replyTo ? [replyTo] : undefined,
              Tags: [{ Name: "email_type", Value: "transactional" }],
            });

            const sesResult = await sesClient.send(command);
            console.log(`Critical alert email sent to ${adminEmails.length} admin(s):`, adminEmails, "MessageId:", sesResult.MessageId);
          } else {
            console.log("No admin emails found for critical alert");
          }
        } else {
          console.log("No super_admin users found for critical alert");
        }
      } catch (alertError) {
        console.error("Failed to send critical alert email:", alertError);
      }
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("cs-daily-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
