import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHORT_LINK_BASE = "https://alunos.criminallab.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

/**
 * Webhook para criar leads no CRM a partir de eventos do WooCommerce:
 * - Carrinho abandonado
 * - PIX não pago
 * - Cartão recusado
 * - Boleto vencido
 *
 * Payload esperado (JSON ou form-urlencoded):
 *   nome       - Nome do contato
 *   email      - Email do contato (obrigatório)
 *   telefone   - Telefone
 *   id         - WooCommerce product ID
 *   produto    - Nome do produto (fallback se id não encontrar)
 *   valor      - Valor da venda
 *   status     - Tipo do evento: abandoned | pix_pending | card_failed | boleto_expired | failed
 *   metodo     - Método de pagamento: pix | card | boleto
 *   recovery_url - URL de recuperação do checkout
 *   order_id   - ID do pedido no WooCommerce (opcional)
 */

// Map WooCommerce status to CRM stage
function mapStatusToStage(status: string, method?: string): string {
  switch (status) {
    case "abandoned":
      return "carrinho_abandonado_1";
    case "pix_pending":
      return "pix_nao_pago_1";
    case "card_failed":
      return "cartao_recusado";
    case "boleto_expired":
      return "pix_nao_pago_1"; // treat as similar to pix
    case "failed":
      // Infer from payment method
      if (method === "pix") return "pix_nao_pago_1";
      if (method === "card" || method === "credit_card") return "cartao_recusado";
      return "carrinho_abandonado_1";
    default:
      return "carrinho_abandonado_1";
  }
}

// Map CRM stage to the specific binding process name
function stageToBindingProcess(stage: string): string {
  if (stage.startsWith("carrinho_abandonado")) return "crm_recovery_carrinho";
  if (stage.startsWith("pix_nao_pago")) return "crm_recovery_pix";
  if (stage === "cartao_recusado") return "crm_recovery_cartao";
  return "crm_recovery_geral";
}

// Build a friendly recovery message based on the stage
function buildRecoveryMessage(
  name: string,
  stage: string,
  productName: string | null,
  recoveryUrl: string | null
): string {
  const firstName = name.split(" ")[0];
  const product = productName || "nosso curso";

  switch (stage) {
    case "carrinho_abandonado_1":
      return `Olá ${firstName}! 😊 Vi que você se interessou pelo ${product} mas não finalizou a compra. Posso te ajudar com alguma dúvida?${recoveryUrl ? `\n\n🔗 Continue sua compra: ${recoveryUrl}` : ""}`;
    case "pix_nao_pago_1":
      return `Oi ${firstName}! Notei que o PIX do ${product} ainda não foi confirmado. Precisa de ajuda? O código pode ter expirado, posso gerar um novo para você!${recoveryUrl ? `\n\n🔗 Acesse aqui: ${recoveryUrl}` : ""}`;
    case "cartao_recusado":
      return `Olá ${firstName}! Parece que houve um problema com o pagamento do ${product} via cartão. Isso pode acontecer por diversos motivos. Quer tentar novamente ou usar outro método de pagamento?${recoveryUrl ? `\n\n🔗 Tente novamente: ${recoveryUrl}` : ""}`;
    default:
      return `Olá ${firstName}! Vi que você demonstrou interesse no ${product}. Posso te ajudar com alguma informação?${recoveryUrl ? `\n\n🔗 Saiba mais: ${recoveryUrl}` : ""}`;
  }
}

// Enqueue a WhatsApp recovery message for a new CRM lead
async function enqueueRecoveryWhatsApp(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  phone: string,
  name: string,
  stage: string,
  productName: string | null,
  recoveryUrl: string | null
): Promise<boolean> {
  const specificProcess = stageToBindingProcess(stage);

  // Try specific binding first, then fallback to crm_recovery_geral
  let binding: any = null;
  for (const process of [specificProcess, "crm_recovery_geral"]) {
    const { data } = await supabase
      .from("whatsapp_template_bindings")
      .select("template_name, connection_id, variable_map")
      .eq("process", process)
      .eq("is_active", true);

    if (data && data.length > 0) {
      // Random selection for A/B testing
      binding = data[Math.floor(Math.random() * data.length)];
      break;
    }
  }

  // Select a connection
  const connectionId = binding?.connection_id || null;
  let finalConnectionId = connectionId;

  if (!finalConnectionId) {
    const { data: connId, error: connErr } = await supabase
      .rpc("select_zapi_connection", { p_is_new_contact: true });
    if (connErr || !connId) {
      console.error("No WhatsApp connection available:", connErr?.message);
      return false;
    }
    finalConnectionId = connId;
  }

  const message = buildRecoveryMessage(name, stage, productName, recoveryUrl);

  // Build template variables if binding exists
  const contextData: Record<string, unknown> = {
    lead_id: leadId,
    stage,
    product_name: productName,
    template_name: binding?.template_name || null,
  };

  if (binding?.variable_map) {
    const varMap = binding.variable_map as Record<string, string>;
    const templateVars: Record<string, string> = {};
    for (const [idx, sysVar] of Object.entries(varMap)) {
      if (!sysVar) continue;
      switch (sysVar) {
        case "lead_name": templateVars[idx] = name.split(" ")[0]; break;
        case "product_name": templateVars[idx] = productName || "nosso curso"; break;
        case "recovery_url": {
          if (recoveryUrl) {
            templateVars[idx] = await shortenUrl(supabase, recoveryUrl, "crm_recovery_woo", productName);
          }
          break;
        }
      }
    }
    // Filter out empty values (Era Cloud constraint)
    for (const [k, v] of Object.entries(templateVars)) {
      if (!v || !v.trim()) delete templateVars[k];
    }
    contextData.template_variables = templateVars;
  }

  // Enqueue via whatsapp_send_queue with crm_recovery context
  const { error: queueErr } = await supabase
    .from("whatsapp_send_queue")
    .insert({
      phone,
      message,
      context_type: "crm_recovery",
      context_data: contextData,
      priority: 8,
      zapi_connection_id: finalConnectionId,
    });

  if (queueErr) {
    console.error("Failed to enqueue WhatsApp:", queueErr.message);
    return false;
  }

  // Log activity on the lead
  await supabase.from("crm_lead_activities").insert({
    lead_id: leadId,
    activity_type: "whatsapp_sent",
    description: `Mensagem de recuperação enviada automaticamente via WhatsApp${binding ? ` (template: ${binding.template_name})` : " (texto direto)"}`,
    metadata: { phone, stage, template: binding?.template_name || "text_direct", process: specificProcess },
  });

  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional webhook secret validation
    const webhookSecret = Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET");
    if (webhookSecret) {
      const receivedSecret =
        req.headers.get("x-webhook-secret") ||
        new URL(req.url).searchParams.get("secret");
      if (receivedSecret !== webhookSecret) {
        console.error("Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Parse payload
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string>;

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    const { nome, email, telefone, id, produto, valor, status, metodo, recovery_url, order_id } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing required field: email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = telefone?.trim() || null;
    const trimmedName = nome?.trim() || trimmedEmail.split("@")[0];
    const productId = id?.trim() || null;
    const saleValue = valor ? parseFloat(valor) : null;
    const stage = mapStatusToStage(status || "abandoned", metodo);

    // Resolve product name from WooCommerce product ID
    let resolvedProductName = produto?.trim() || null;
    let resolvedProductType: string | null = null;

    if (productId && !resolvedProductName) {
      // Try packages
      const { data: pkg } = await supabase
        .from("packages")
        .select("name")
        .eq("woocommerce_product_id", productId)
        .maybeSingle();

      if (pkg) {
        resolvedProductName = pkg.name;
        resolvedProductType = "package";
      } else {
        // Try courses
        const { data: course } = await supabase
          .from("courses")
          .select("name")
          .eq("woocommerce_product_id", productId)
          .maybeSingle();

        if (course) {
          resolvedProductName = course.name;
          resolvedProductType = "course";
        } else {
          // Try combos
          const { data: combo } = await supabase
            .from("combos")
            .select("name")
            .eq("woocommerce_product_id", productId)
            .maybeSingle();

          if (combo) {
            resolvedProductName = combo.name;
            resolvedProductType = "combo";
          }
        }
      }
    }

    // Check if profile exists (link to existing student)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();

    // Deduplication: check if lead already exists with same email + product + active stage
    const { data: existingLead } = await supabase
      .from("crm_leads")
      .select("id, stage")
      .eq("email", trimmedEmail)
      .not("stage", "in", "(convertido,perdido)")
      .maybeSingle();

    if (existingLead) {
      // Update existing lead instead of creating duplicate
      const updates: Record<string, unknown> = {};

      // If current stage is a "1" variant and incoming is same category, bump to "2"
      if (
        existingLead.stage === "carrinho_abandonado_1" &&
        stage === "carrinho_abandonado_1"
      ) {
        updates.stage = "carrinho_abandonado_2";
      } else if (
        existingLead.stage === "pix_nao_pago_1" &&
        stage === "pix_nao_pago_1"
      ) {
        updates.stage = "pix_nao_pago_2";
      } else if (existingLead.stage !== stage) {
        // Different stage type, update to new one
        updates.stage = stage;
      }

      if (trimmedPhone) updates.phone = trimmedPhone;
      if (saleValue) updates.sale_value = saleValue;
      if (recovery_url) updates.recovery_url = recovery_url;
      if (resolvedProductName) updates.product_name = resolvedProductName;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("crm_leads")
          .update(updates)
          .eq("id", existingLead.id);

        // Log stage change activity if stage changed
        if (updates.stage) {
          await supabase.from("crm_lead_activities").insert({
            lead_id: existingLead.id,
            activity_type: "stage_change",
            description: `Webhook: movido para ${updates.stage} (evento: ${status || "abandoned"})`,
            metadata: { source: "woocommerce", order_id, status, metodo },
          });
        }
      }

      console.log(`CRM lead updated: ${existingLead.id} for ${trimmedEmail}`);

      return new Response(
        JSON.stringify({
          success: true,
          action: "updated",
          lead_id: existingLead.id,
          stage: updates.stage || existingLead.stage,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create new lead
    const { data: newLead, error: insertError } = await supabase
      .from("crm_leads")
      .insert({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        stage,
        product_name: resolvedProductName,
        product_id: productId,
        product_type: resolvedProductType,
        sale_value: saleValue,
        source: "woocommerce",
        profile_id: existingProfile?.id || null,
        recovery_url: recovery_url || null,
        metadata: { order_id, payment_method: metodo, raw_status: status },
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create CRM lead:", insertError);
      return new Response(
        JSON.stringify({ error: `Failed to create lead: ${insertError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Add initial activity
    await supabase.from("crm_lead_activities").insert({
      lead_id: newLead.id,
      activity_type: "note",
      description: `Lead criado via webhook WooCommerce (${status || "abandoned"}, método: ${metodo || "desconhecido"})`,
      metadata: { source: "woocommerce", order_id },
    });

    // Auto-send WhatsApp recovery message if phone is available
    let whatsappQueued = false;
    if (trimmedPhone) {
      try {
        whatsappQueued = await enqueueRecoveryWhatsApp(
          supabase, newLead.id, trimmedPhone, trimmedName, stage, resolvedProductName, recovery_url
        );
      } catch (waErr) {
        console.error("Failed to enqueue WhatsApp recovery:", waErr);
      }
    }

    console.log(`CRM lead created: ${newLead.id} for ${trimmedEmail} (stage: ${stage}, whatsapp: ${whatsappQueued})`);

    return new Response(
      JSON.stringify({
        success: true,
        action: "created",
        lead_id: newLead.id,
        stage,
        whatsapp_queued: whatsappQueued,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("CRM webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
