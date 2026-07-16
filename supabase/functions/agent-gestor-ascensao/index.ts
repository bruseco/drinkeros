import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Agent Gestor Ascensão — Daily health monitor for the upsell pipeline.
 * Checks: sequences created vs backlog, products without URLs, combos not offered.
 * Sends alert via WhatsApp to admin if pipeline is underperforming.
 * Registers findings in cs_timeline_events.
 */

const UPSELL_CONNECTION_ID = "c0332f67-c559-4a6a-b406-68691bdd780b";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Count total students with products (non-admin)
    const { data: adminRoles } = await adminClient.from("user_roles").select("user_id");
    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    const [userPkgsRes, userCoursesRes, userCombosRes] = await Promise.all([
      adminClient.from("user_packages").select("user_id"),
      adminClient.from("user_courses").select("user_id"),
      adminClient.from("user_combos").select("user_id"),
    ]);

    const allStudentIds = new Set<string>();
    for (const up of (userPkgsRes.data || [])) if (!adminIds.has(up.user_id)) allStudentIds.add(up.user_id);
    for (const uc of (userCoursesRes.data || [])) if (!adminIds.has(uc.user_id)) allStudentIds.add(uc.user_id);
    for (const ucb of (userCombosRes.data || [])) if (!adminIds.has(ucb.user_id)) allStudentIds.add(ucb.user_id);
    const totalStudents = allStudentIds.size;

    // 2. Count sequences
    const { data: allSeqs } = await adminClient.from("upsell_sequences").select("id, status, created_at, product_type, product_id");
    const seqs = allSeqs || [];
    const totalSeqs = seqs.length;
    const activeSeqs = seqs.filter((s: any) => s.status === "active").length;
    const completedSeqs = seqs.filter((s: any) => s.status === "completed").length;
    const convertedSeqs = seqs.filter((s: any) => s.status === "converted").length;

    // Sequences created in last 24h
    const recentSeqs = seqs.filter((s: any) => new Date(s.created_at) >= new Date(twentyFourHoursAgo)).length;

    // 3. Check products without checkout URL
    const [coursesRes, combosRes, packagesRes] = await Promise.all([
      adminClient.from("courses").select("id, name, checkout_url, is_available_for_sale, is_active"),
      adminClient.from("combos").select("id, name, checkout_url, is_available_for_sale, is_active"),
      adminClient.from("packages").select("id, name, checkout_url, is_available_for_sale, is_active, is_free"),
    ]);

    const productsWithoutUrl: string[] = [];
    for (const c of (coursesRes.data || [])) {
      if (c.is_active && c.is_available_for_sale && !c.checkout_url) {
        productsWithoutUrl.push(`Curso: ${c.name}`);
      }
    }
    for (const cb of (combosRes.data || [])) {
      if (cb.is_active && cb.is_available_for_sale && !cb.checkout_url) {
        productsWithoutUrl.push(`Combo: ${cb.name}`);
      }
    }
    for (const p of (packagesRes.data || [])) {
      if (p.is_active && p.is_available_for_sale && !p.is_free && !p.checkout_url) {
        productsWithoutUrl.push(`Módulo: ${p.name}`);
      }
    }

    // 4. Check combo coverage in sequences
    const comboSeqs = seqs.filter((s: any) => s.product_type === "combo");
    const sellableCombos = (combosRes.data || []).filter((cb: any) => cb.is_active && cb.is_available_for_sale && cb.checkout_url);

    // 5. Check upsell_settings
    const { data: settings } = await adminClient.from("upsell_settings").select("*").limit(1).single();

    // 6. Build alert report
    const alerts: string[] = [];
    const coveragePercent = totalStudents > 0 ? ((totalSeqs / totalStudents) * 100).toFixed(1) : "0";
    const backlog = totalStudents - totalSeqs;

    if (recentSeqs < 50) {
      alerts.push(`⚠️ Apenas ${recentSeqs} sequências criadas nas últimas 24h (esperado: 200+)`);
    }
    if (backlog > 100) {
      alerts.push(`📊 Backlog: ${backlog} alunos sem sequência (${coveragePercent}% cobertura)`);
    }
    if (productsWithoutUrl.length > 0) {
      alerts.push(`🔗 ${productsWithoutUrl.length} produto(s) sem URL de checkout: ${productsWithoutUrl.join(", ")}`);
    }
    if (comboSeqs.length === 0 && sellableCombos.length > 0) {
      alerts.push(`🎯 ${sellableCombos.length} combo(s) vendáveis nunca foram ofertados em upsell`);
    }
    if (!settings?.is_enabled) {
      alerts.push(`🚫 Sistema de upsell está DESATIVADO`);
    }
    if (!settings?.whatsapp_enabled) {
      alerts.push(`📱 WhatsApp upsell está DESATIVADO`);
    }
    if (convertedSeqs === 0 && totalSeqs > 50) {
      alerts.push(`💰 Nenhuma conversão registrada entre ${totalSeqs} sequências — verificar tracking`);
    }

    const reportLines = [
      `📈 *Relatório Diário — Máquina de Ascensão*`,
      ``,
      `👥 Alunos: ${totalStudents}`,
      `📬 Sequências: ${totalSeqs} (${coveragePercent}% cobertura)`,
      `  ├ Ativas: ${activeSeqs}`,
      `  ├ Concluídas: ${completedSeqs}`,
      `  └ Convertidas: ${convertedSeqs}`,
      `📊 Criadas (24h): ${recentSeqs}`,
      `🎯 Backlog: ${backlog}`,
      ``,
    ];

    if (alerts.length > 0) {
      reportLines.push(`*ALERTAS:*`);
      for (const a of alerts) reportLines.push(a);
    } else {
      reportLines.push(`✅ Pipeline saudável, sem alertas.`);
    }

    const reportText = reportLines.join("\n");
    console.log(`[agent-gestor-ascensao] Report:\n${reportText}`);

    // 7. Log to cs_timeline_events
    await adminClient.from("cs_timeline_events").insert({
      event_type: "agent_gestor_ascensao",
      event_subtype: alerts.length > 0 ? "alert" : "ok",
      channel: "system",
      summary: `Pipeline: ${totalSeqs}/${totalStudents} (${coveragePercent}%), 24h: ${recentSeqs}, alertas: ${alerts.length}`,
      metadata: {
        total_students: totalStudents,
        total_sequences: totalSeqs,
        active: activeSeqs,
        completed: completedSeqs,
        converted: convertedSeqs,
        recent_24h: recentSeqs,
        backlog,
        alerts,
        products_without_url: productsWithoutUrl,
        combo_sequences: comboSeqs.length,
        sellable_combos: sellableCombos.length,
      },
    });

    // 8. Send WhatsApp alert to admin if there are issues
    if (alerts.length > 0) {
      const { data: adminProfiles } = await adminClient
        .from("profiles")
        .select("phone, user_id")
        .in("user_id", Array.from(adminIds))
        .not("phone", "is", null);

      if (adminProfiles && adminProfiles.length > 0) {
        const adminPhone = adminProfiles[0].phone;
        if (adminPhone) {
          await adminClient.from("whatsapp_send_queue").insert({
            phone: adminPhone,
            message: reportText,
            context_type: "agent_gestor_ascensao",
            priority: 5,
            zapi_connection_id: UPSELL_CONNECTION_ID,
          });
          console.log(`[agent-gestor-ascensao] Alert queued to admin ${adminPhone}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalStudents,
      totalSequences: totalSeqs,
      coverage: coveragePercent,
      recentSequences: recentSeqs,
      backlog,
      alerts,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("agent-gestor-ascensao error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
