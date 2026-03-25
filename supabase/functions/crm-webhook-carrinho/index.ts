import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIXED_STAGE = "carrinho_abandonado_1";
const SHORT_LINK_BASE = "https://alunos.criminallab.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function stageToBindingProcess(stage: string): string {
  if (stage === "carrinho_abandonado_1") return "crm_recovery_carrinho_1";
  if (stage === "carrinho_abandonado_2") return "crm_recovery_carrinho_2";
  if (stage.startsWith("carrinho_abandonado")) return "crm_recovery_carrinho_1";
  if (stage.startsWith("pix_nao_pago")) return "crm_recovery_pix";
  if (stage === "cartao_recusado") return "crm_recovery_cartao";
  return "crm_recovery_geral";
}

async function shortenUrl(
  supabase: ReturnType<typeof createClient>,
  url: string, source: string, productName: string | null
): Promise<string> {
  const code = crypto.randomUUID().replace(/-/g, "");
  await supabase.from("redirect_links").insert({
    code, destination_url: url, source, product_name: productName || "CRM Recovery",
  });
  return `${SHORT_LINK_BASE}/?trigger=${code}`;
}

async function enqueueRecoveryWhatsApp(
  supabase: ReturnType<typeof createClient>,
  leadId: string, phone: string, name: string, stage: string,
  productName: string | null, recoveryUrl: string | null
): Promise<boolean> {
  const specificProcess = stageToBindingProcess(stage);
  let binding: any = null;
  for (const process of [specificProcess, "crm_recovery_geral"]) {
    const { data } = await supabase
      .from("whatsapp_template_bindings")
      .select("template_name, connection_id, variable_map")
      .eq("process", process).eq("is_active", true);
    if (data && data.length > 0) {
      binding = data[Math.floor(Math.random() * data.length)];
      break;
    }
  }

  // Template obrigatório — sem binding configurado, não envia
  if (!binding) {
    console.log(`No template binding found for ${specificProcess}, skipping WhatsApp`);
    return false;
  }

  const finalConnectionId = binding.connection_id;

  const message = `[Template: ${binding.template_name}]`;
  const contextData: Record<string, unknown> = {
    lead_id: leadId, stage, product_name: productName,
    template_name: binding.template_name,
  };

  const varMap = binding.variable_map as Record<string, string>;
  const templateVars: Record<string, string> = {};
  for (const [idx, sysVar] of Object.entries(varMap)) {
    if (!sysVar) continue;
    switch (sysVar) {
      case "lead_name": templateVars[idx] = name.split(" ")[0]; break;
      case "product_name": templateVars[idx] = productName || "nosso curso"; break;
      case "recovery_url": {
          if (recoveryUrl) {
            templateVars[idx] = await shortenUrl(supabase, recoveryUrl, "crm_recovery", productName);
          }
          break;
        }
    }
  }
  for (const [k, v] of Object.entries(templateVars)) { if (!v || !v.trim()) delete templateVars[k]; }
  contextData.template_variables = templateVars;

  const { error: queueErr } = await supabase.from("whatsapp_send_queue").insert({
    phone, message, context_type: "crm_recovery", context_data: contextData,
    priority: 8, zapi_connection_id: finalConnectionId,
  });
  if (queueErr) { console.error("Failed to enqueue WhatsApp:", queueErr.message); return false; }

  await supabase.from("crm_lead_activities").insert({
    lead_id: leadId, activity_type: "whatsapp_sent",
    description: `Mensagem de recuperação enviada via WhatsApp (template: ${binding.template_name})`,
    metadata: { phone, stage, template: binding.template_name, process: specificProcess },
  });
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string>;
    if (contentType.includes("application/json")) { body = await req.json(); }
    else { const text = await req.text(); body = Object.fromEntries(new URLSearchParams(text).entries()); }

    const { nome, email, telefone, produto, valor, recovery_url } = body;
    if (!email) return new Response(JSON.stringify({ error: "Missing required field: email" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = telefone?.trim() || null;
    const trimmedName = nome?.trim() || trimmedEmail.split("@")[0];
    const saleValue = valor ? parseFloat(valor) : null;

    // === CHECK IF EMAIL ALREADY HAS ENROLLMENT (skip recovery if already a student) ===
    const { data: enrolledProfile } = await supabase.from("profiles").select("user_id").eq("email", trimmedEmail).maybeSingle();
    if (enrolledProfile) {
      const [{ count: pkgCount }, { count: courseCount }, { count: comboCount }] = await Promise.all([
        supabase.from("user_packages").select("id", { count: "exact", head: true }).eq("user_id", enrolledProfile.user_id),
        supabase.from("user_courses").select("id", { count: "exact", head: true }).eq("user_id", enrolledProfile.user_id),
        supabase.from("user_combos").select("id", { count: "exact", head: true }).eq("user_id", enrolledProfile.user_id),
      ]);
      const totalEnrollments = (pkgCount || 0) + (courseCount || 0) + (comboCount || 0);
      if (totalEnrollments > 0) {
        console.log(`Email ${trimmedEmail} already has ${totalEnrollments} enrollments, marking as converted`);
        // Check if there's an existing active lead to mark as converted
        const { data: activeLead } = await supabase.from("crm_leads").select("id")
          .eq("email", trimmedEmail).not("stage", "in", "(convertido,perdido)").maybeSingle();
        if (activeLead) {
          await supabase.from("crm_leads").update({ stage: "convertido", converted_at: new Date().toISOString() }).eq("id", activeLead.id);
          await supabase.from("crm_lead_activities").insert({
            lead_id: activeLead.id, activity_type: "stage_change",
            description: "Convertido automaticamente: email já possui matrícula ativa",
            metadata: { source: "crm-webhook-carrinho", enrollments: totalEnrollments },
          });
        }
        return new Response(JSON.stringify({ success: true, action: "skipped_enrolled", email: trimmedEmail }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }
    const stage = FIXED_STAGE;

    // Product name comes directly (can be comma-separated list of product names)
    const resolvedProductName = produto?.trim() || null;

    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", trimmedEmail).maybeSingle();

    // Deduplication
    const { data: existingLead } = await supabase.from("crm_leads").select("id, stage")
      .eq("email", trimmedEmail).not("stage", "in", "(convertido,perdido)").maybeSingle();

    if (existingLead) {
      const updates: Record<string, unknown> = {};
      if (existingLead.stage === "carrinho_abandonado_1" && stage === "carrinho_abandonado_1") updates.stage = "carrinho_abandonado_2";
      else if (existingLead.stage !== stage) updates.stage = stage;
      if (trimmedPhone) updates.phone = trimmedPhone;
      if (saleValue) updates.sale_value = saleValue;
      if (recovery_url) updates.recovery_url = recovery_url;
      if (resolvedProductName) updates.product_name = resolvedProductName;

      if (Object.keys(updates).length > 0) {
        await supabase.from("crm_leads").update(updates).eq("id", existingLead.id);
        if (updates.stage) {
          await supabase.from("crm_lead_activities").insert({
            lead_id: existingLead.id, activity_type: "stage_change",
            description: `Webhook carrinho: movido para ${updates.stage}`,
            metadata: { source: "woocommerce" },
          });
        }
      }
      console.log(`CRM lead updated: ${existingLead.id} for ${trimmedEmail}`);
      return new Response(JSON.stringify({ success: true, action: "updated", lead_id: existingLead.id, stage: updates.stage || existingLead.stage }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Create new lead
    const { data: newLead, error: insertError } = await supabase.from("crm_leads").insert({
      name: trimmedName, email: trimmedEmail, phone: trimmedPhone, stage,
      product_name: resolvedProductName,
      sale_value: saleValue, source: "woocommerce", profile_id: existingProfile?.id || null,
      recovery_url: recovery_url || null,
    }).select("id").single();

    if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });

    await supabase.from("crm_lead_activities").insert({
      lead_id: newLead.id, activity_type: "note",
      description: `Lead criado via webhook crm-webhook-carrinho`,
      metadata: { source: "woocommerce" },
    });

    let whatsappQueued = false;
    if (trimmedPhone) {
      try { whatsappQueued = await enqueueRecoveryWhatsApp(supabase, newLead.id, trimmedPhone, trimmedName, stage, resolvedProductName, recovery_url); }
      catch (e) { console.error("WhatsApp error:", e); }
    }

    console.log(`CRM lead created: ${newLead.id} (stage: ${stage}, whatsapp: ${whatsappQueued})`);
    return new Response(JSON.stringify({ success: true, action: "created", lead_id: newLead.id, stage, whatsapp_queued: whatsappQueued }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("CRM webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
