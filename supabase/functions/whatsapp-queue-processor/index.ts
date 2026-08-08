import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

interface WhatsAppCredentials {
  provider: string;
  instanceId: string | null;
  token: string | null;
  securityToken: string | null;
  apiUrl: string | null;
  instanceName: string | null;
  connectionId: string | null;
}

async function sendWhatsAppMessage(phone: string, message: string, creds: WhatsAppCredentials): Promise<any> {
  if (creds.provider === 'era_cloud') {
    const url = `${creds.apiUrl}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
      body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Era Cloud API error [${res.status}]: ${JSON.stringify(data)}`);
    return data;
  } else {
    const zapiUrl = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": creds.securityToken! },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Z-API error [${res.status}]: ${JSON.stringify(data)}`);
    return data;
  }
}

async function sendTemplateMessage(phone: string, templateName: string, parameters: string[], creds: WhatsAppCredentials): Promise<any> {
  const url = `${creds.apiUrl}/v1/messages`;
  const body = {
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [{ type: "body", parameters: parameters.map((p) => ({ type: "text", text: p })) }],
    },
  };
  console.log(`[queue-processor] Sending template '${templateName}' to ${phone}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Era Cloud template error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function getCredentialsForItem(
  supabase: any,
  item: any,
  phone: string
): Promise<WhatsAppCredentials> {
  if (item.zapi_connection_id) {
    const { data: creds } = await supabase.rpc("get_zapi_credentials", { p_connection_id: item.zapi_connection_id });
    if (creds && creds.length > 0) {
      return {
        provider: creds[0].provider || 'zapi',
        instanceId: creds[0].instance_id,
        token: creds[0].token,
        securityToken: creds[0].security_token,
        apiUrl: creds[0].api_url,
        instanceName: creds[0].instance_name,
        connectionId: item.zapi_connection_id,
      };
    }
  }

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id, zapi_connection_id")
    .eq("phone", phone)
    .maybeSingle();

  if (conv?.zapi_connection_id) {
    const { data: creds } = await supabase.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
    if (creds && creds.length > 0) {
      return {
        provider: creds[0].provider || 'zapi',
        instanceId: creds[0].instance_id,
        token: creds[0].token,
        securityToken: creds[0].security_token,
        apiUrl: creds[0].api_url,
        instanceName: creds[0].instance_name,
        connectionId: conv.zapi_connection_id,
      };
    }
  }

  const { data: connections } = await supabase
    .from("zapi_connections")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (connections && connections.length > 0) {
    const isNewContact = !conv;
    const { data: connectionId, error: rpcError } = await supabase
      .rpc("select_zapi_connection", {
        p_conversation_id: conv?.id || null,
        p_is_new_contact: isNewContact,
      });

    if (rpcError) {
      if (rpcError.message?.includes("DAILY_LIMIT_REACHED")) throw new Error("DAILY_LIMIT_REACHED");
      throw rpcError;
    }

    if (connectionId) {
      const { data: creds } = await supabase.rpc("get_zapi_credentials", { p_connection_id: connectionId });
      if (creds && creds.length > 0) {
        return {
          provider: creds[0].provider || 'zapi',
          instanceId: creds[0].instance_id,
          token: creds[0].token,
          securityToken: creds[0].security_token,
          apiUrl: creds[0].api_url,
          instanceName: creds[0].instance_name,
          connectionId,
        };
      }
    }
  }

  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const zapiToken = Deno.env.get("ZAPI_TOKEN");
  const securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN");
  if (!instanceId || !zapiToken || !securityToken) throw new Error("WhatsApp credentials not configured");
  return { provider: 'zapi', instanceId, token: zapiToken, securityToken, apiUrl: null, instanceName: null, connectionId: null };
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

    const { data: pendingItems, error: fetchError } = await supabase
      .rpc("claim_whatsapp_queue_items", { batch_size: 30 });

    if (fetchError) throw fetchError;

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const phone = normalizePhone(item.phone);

      try {
        const whatsappCreds = await getCredentialsForItem(supabase, item, phone);

        // Check connection status (skip for evolution - no ban risk)
        if (whatsappCreds.connectionId) {
          const { data: connStatus } = await supabase
            .from("zapi_connections")
            .select("connection_status, is_active")
            .eq("id", whatsappCreds.connectionId)
            .maybeSingle();

          if (connStatus && (connStatus.connection_status === "disconnected" || !connStatus.is_active)) {
            console.log(`[queue-processor] Connection ${whatsappCreds.connectionId} is disconnected, keeping item ${item.id} in queue`);
            await supabase
              .from("whatsapp_send_queue")
              .update({ status: "pending" })
              .eq("id", item.id);
            continue;
          }
        }

        // ─── onboarding_followup: send template directly ───
        if (item.context_type === 'onboarding_followup' && whatsappCreds.provider === 'era_cloud') {
          let msgPayload: any = null;
          try { msgPayload = JSON.parse(item.message); } catch { /* not JSON */ }

          if (msgPayload?.type === 'template') {
            const varMap = (msgPayload.variable_map || {}) as Record<string, string>;
            const variableValues = (msgPayload.variables || {}) as Record<string, string>;
            const maxIdx = Object.keys(varMap).length > 0
              ? Math.max(...Object.keys(varMap).map(Number))
              : 0;
            const parameters: string[] = [];
            for (let i = 1; i <= maxIdx; i++) {
              const sysVar = varMap[String(i)] || "";
              parameters.push(variableValues[sysVar] || "");
            }

            const tplResponse = await sendTemplateMessage(phone, msgPayload.template_name, parameters, whatsappCreds);
            console.log(`[queue-processor] Onboarding template '${msgPayload.template_name}' sent to ${phone} — Response:`, JSON.stringify(tplResponse));

            // Register conversation
            const { data: existingConvOB } = await supabase
              .from("whatsapp_conversations")
              .select("id, profile_id")
              .eq("phone", phone)
              .maybeSingle();

            let convIdOB = existingConvOB?.id;
            if (!convIdOB) {
              const { data: profileOB } = await supabase
                .from("profiles")
                .select("id, full_name")
                .or(`phone.eq.${phone},phone.eq.+${phone}`)
                .maybeSingle();
              const { data: newConvOB } = await supabase
                .from("whatsapp_conversations")
                .insert({
                  phone,
                  profile_id: profileOB?.id || null,
                  contact_name: profileOB?.full_name || null,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: `[Template ${msgPayload.template_name}] onboarding`,
                  status: "open",
                  zapi_connection_id: whatsappCreds.connectionId,
                })
                .select("id")
                .single();
              convIdOB = newConvOB?.id;
            } else {
              const updateDataOB: any = {
                last_message_at: new Date().toISOString(),
                last_message_preview: `[Template ${msgPayload.template_name}] onboarding`,
                zapi_connection_id: whatsappCreds.connectionId || undefined,
              };
              if (!existingConvOB.profile_id) {
                const { data: profileMatchOB } = await supabase
                  .from("profiles")
                  .select("id, full_name")
                  .or(`phone.eq.${phone},phone.eq.+${phone}`)
                  .maybeSingle();
                if (profileMatchOB) {
                  updateDataOB.profile_id = profileMatchOB.id;
                  updateDataOB.contact_name = profileMatchOB.full_name;
                }
              }
              await supabase.from("whatsapp_conversations").update(updateDataOB).eq("id", convIdOB);
            }

            if (convIdOB) {
              // Resolve template body for display
              let tplMetaOB: Record<string, any> = { source: "onboarding_followup", template_name: msgPayload.template_name };
              try {
                const { data: tplDataOB } = await supabase
                  .from("whatsapp_templates")
                  .select("components")
                  .eq("name", msgPayload.template_name)
                  .maybeSingle();
                if (tplDataOB?.components && Array.isArray(tplDataOB.components)) {
                  for (const comp of tplDataOB.components as any[]) {
                    if (comp.type === "BODY" && comp.text) {
                      let body = comp.text as string;
                      parameters.forEach((val: string, idx: number) => {
                        body = body.replace(`{{${idx + 1}}}`, val);
                      });
                      tplMetaOB.template_body = body;
                    }
                    if (comp.type === "HEADER" && comp.text) {
                      tplMetaOB.template_header = comp.text;
                    }
                  }
                }
              } catch (tplErr) {
                console.error(`[queue-processor] Failed to resolve template body:`, tplErr);
              }

              await supabase.from("whatsapp_messages").insert({
                conversation_id: convIdOB,
                direction: "outbound",
                message_type: "template",
                content: `[Template: ${msgPayload.template_name}] ${parameters.join(", ")}`,
                zapi_message_id: tplResponse?.messages?.[0]?.id || tplResponse?.messageId || null,
                status: "sent",
                metadata: tplMetaOB,
              });
            }

            // Update onboarding_followup_logs: mark whatsapp_sent = true
            if (item.context_data?.user_id) {
              await supabase.from("onboarding_followup_logs")
                .update({ whatsapp_sent: true })
                .eq("user_id", item.context_data.user_id);
            }

            // Timeline event
            try {
              await supabase.from("cs_timeline_events").insert({
                event_type: "onboarding_followup",
                event_subtype: "sent",
                user_id: item.context_data?.user_id || null,
                phone,
                channel: "whatsapp",
                summary: `Template onboarding enviado para ${phone}`,
                metadata: { template_name: msgPayload.template_name, queue_item_id: item.id },
              });
            } catch (tlErr) {
              console.error(`[queue-processor] Timeline error:`, tlErr);
            }

            await supabase.from("whatsapp_send_queue").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              attempts: item.attempts + 1,
            }).eq("id", item.id);

            sentCount++;
            continue;
          }
        }

        // ─── crm_recovery: check enrollment before sending ───
        if (item.context_type === 'crm_recovery') {
          const leadId = (item.context_data as any)?.lead_id;
          let leadFunnelValue: string | null = null;
          if (leadId) {
            const { data: lead } = await supabase.from("crm_leads").select("email, funnel").eq("id", leadId).maybeSingle();
            leadFunnelValue = lead?.funnel || null;
            // Skip enrollment guardrail for pico_vendas funnel (seasonal events for all users)
            if (lead?.email && lead?.funnel !== 'pico_vendas') {
              const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", lead.email).maybeSingle();
              if (profile?.user_id) {
                const [{ count: pkgC }, { count: crsC }, { count: cmbC }] = await Promise.all([
                  supabase.from("user_packages").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
                  supabase.from("user_courses").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
                  supabase.from("user_combos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
                ]);
                if ((pkgC || 0) + (crsC || 0) + (cmbC || 0) > 0) {
                  console.log(`[queue-processor] Lead ${leadId} already enrolled — skipping CRM recovery`);
                  await supabase.from("whatsapp_send_queue").update({
                    status: "failed", attempts: item.attempts + 1,
                    error_message: "Cancelado: aluno já matriculado",
                  }).eq("id", item.id);
                  await supabase.from("crm_leads").update({ stage: "convertido", converted_at: new Date().toISOString() }).eq("id", leadId);
                  failedCount++;
                  continue;
                }
              }
            }
          }
          const ctx = item.context_data || {};
          const templateName = ctx.template_name as string | undefined;
          const funnelLabel = leadFunnelValue === 'pico_vendas' ? 'pico de vendas' : 'recuperação';
          const templateVariables = (ctx.variables || ctx.template_variables || {}) as Record<string, string>;

          if (!templateName) {
            console.error(`[queue-processor] crm_recovery item ${item.id} has no template_name in context_data — marking as failed`);
            await supabase.from("whatsapp_send_queue").update({
              status: "failed",
              attempts: item.attempts + 1,
              error_message: "No template_name in context_data — cannot send CRM recovery without approved template",
            }).eq("id", item.id);
            failedCount++;
            continue;
          }

          if (whatsappCreds.provider !== 'era_cloud') {
            console.error(`[queue-processor] crm_recovery item ${item.id} requires era_cloud provider, got ${whatsappCreds.provider} — marking as failed`);
            await supabase.from("whatsapp_send_queue").update({
              status: "failed",
              attempts: item.attempts + 1,
              error_message: `CRM recovery requires era_cloud provider, got ${whatsappCreds.provider}`,
            }).eq("id", item.id);
            failedCount++;
            continue;
          }

          // Build parameters array from template_variables (keys are "1", "2", etc.)
          const maxIdx = Object.keys(templateVariables).length > 0
            ? Math.max(...Object.keys(templateVariables).map(Number))
            : 0;
          const parameters: string[] = [];
          for (let idx = 1; idx <= maxIdx; idx++) {
            parameters.push(templateVariables[String(idx)] || "");
          }

          const tplResponse = await sendTemplateMessage(phone, templateName, parameters, whatsappCreds);
          console.log(`[queue-processor] CRM recovery template '${templateName}' sent to ${phone} — Response:`, JSON.stringify(tplResponse));

          // Register conversation
          const { data: existingConvCRM } = await supabase
            .from("whatsapp_conversations")
            .select("id, profile_id")
            .eq("phone", phone)
            .maybeSingle();

          let convIdCRM = existingConvCRM?.id;
          if (!convIdCRM) {
            const { data: profileCRM } = await supabase
              .from("profiles")
              .select("id, full_name")
              .or(`phone.eq.${phone},phone.eq.+${phone}`)
              .maybeSingle();
            const contactName = profileCRM?.full_name || (ctx.lead_name as string) || null;
            const { data: newConvCRM } = await supabase
              .from("whatsapp_conversations")
              .insert({
                phone,
                profile_id: profileCRM?.id || null,
                contact_name: contactName,
                last_message_at: new Date().toISOString(),
                last_message_preview: `[Template ${templateName}] ${funnelLabel}`,
                status: "open",
                zapi_connection_id: whatsappCreds.connectionId,
              })
              .select("id")
              .single();
            convIdCRM = newConvCRM?.id;
          } else {
            const updateDataCRM: any = {
              last_message_at: new Date().toISOString(),
              last_message_preview: `[Template ${templateName}] ${funnelLabel}`,
              zapi_connection_id: whatsappCreds.connectionId || undefined,
            };
            if (!existingConvCRM.profile_id) {
              const { data: profileMatchCRM } = await supabase
                .from("profiles")
                .select("id, full_name")
                .or(`phone.eq.${phone},phone.eq.+${phone}`)
                .maybeSingle();
              if (profileMatchCRM) {
                updateDataCRM.profile_id = profileMatchCRM.id;
                updateDataCRM.contact_name = profileMatchCRM.full_name;
              }
            }
            await supabase.from("whatsapp_conversations").update(updateDataCRM).eq("id", convIdCRM);
          }

          if (convIdCRM) {
            // Resolve template body for chat display
            let tplMetaCRM: Record<string, any> = { source: "crm_recovery", template_name: templateName, lead_id: ctx.lead_id };
            try {
              const { data: tplDataCRM } = await supabase
                .from("whatsapp_templates")
                .select("components")
                .eq("name", templateName)
                .maybeSingle();
              if (tplDataCRM?.components && Array.isArray(tplDataCRM.components)) {
                for (const comp of tplDataCRM.components as any[]) {
                  if (comp.type === "BODY" && comp.text) {
                    let body = comp.text as string;
                    parameters.forEach((val: string, idx: number) => {
                      body = body.replace(`{{${idx + 1}}}`, val);
                    });
                    tplMetaCRM.template_body = body;
                  }
                  if (comp.type === "HEADER" && comp.text) {
                    tplMetaCRM.template_header = comp.text;
                  }
                }
              }
            } catch (tplErr) {
              console.error(`[queue-processor] Failed to resolve CRM template body:`, tplErr);
            }

            await supabase.from("whatsapp_messages").insert({
              conversation_id: convIdCRM,
              direction: "outbound",
              message_type: "template",
              content: `[Template: ${templateName}] ${parameters.join(", ")}`,
              zapi_message_id: tplResponse?.messages?.[0]?.id || tplResponse?.messageId || null,
              status: "sent",
              metadata: tplMetaCRM,
            });
          }

          // Timeline event
          try {
            await supabase.from("cs_timeline_events").insert({
              event_type: "crm_recovery",
              event_subtype: "sent",
              phone,
              channel: "whatsapp",
              summary: `Template ${funnelLabel} '${templateName}' enviado para ${phone}`,
              metadata: { template_name: templateName, lead_id: ctx.lead_id, queue_item_id: item.id },
            });
          } catch (tlErr) {
            console.error(`[queue-processor] Timeline error:`, tlErr);
          }

          await supabase.from("whatsapp_send_queue").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: item.attempts + 1,
          }).eq("id", item.id);

          sentCount++;
          continue;
        }

        // ─── study_reminder: send template directly (same pattern as onboarding) ───
        if (item.context_type === 'study_reminder' && whatsappCreds.provider === 'era_cloud') {
          let msgPayloadSR: any = null;
          try { msgPayloadSR = JSON.parse(item.message); } catch { /* not JSON */ }

          if (msgPayloadSR?.type === 'template') {
            const varMapSR = (msgPayloadSR.variable_map || {}) as Record<string, string>;
            const variableValuesSR = (msgPayloadSR.variables || {}) as Record<string, string>;
            const maxIdxSR = Object.keys(varMapSR).length > 0
              ? Math.max(...Object.keys(varMapSR).map(Number))
              : 0;
            const parametersSR: string[] = [];
            for (let j = 1; j <= maxIdxSR; j++) {
              const sysVar = varMapSR[String(j)] || "";
              // Support both numeric keys ("1") and system var name keys ("student_name")
              const val = variableValuesSR[String(j)] || variableValuesSR[sysVar] || "";
              parametersSR.push(val.trim() || " ");
            }

            const tplResponseSR = await sendTemplateMessage(phone, msgPayloadSR.template_name, parametersSR.filter(p => p.trim()), whatsappCreds);
            console.log(`[queue-processor] Study reminder template '${msgPayloadSR.template_name}' sent to ${phone} — Response:`, JSON.stringify(tplResponseSR));

            // Register conversation
            const { data: existingConvSR } = await supabase
              .from("whatsapp_conversations")
              .select("id, profile_id")
              .eq("phone", phone)
              .maybeSingle();

            let convIdSR = existingConvSR?.id;
            if (!convIdSR) {
              const { data: profileSR } = await supabase
                .from("profiles")
                .select("id, full_name")
                .or(`phone.eq.${phone},phone.eq.+${phone}`)
                .maybeSingle();
              const { data: newConvSR } = await supabase
                .from("whatsapp_conversations")
                .insert({
                  phone,
                  profile_id: profileSR?.id || null,
                  contact_name: profileSR?.full_name || null,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: `[Template ${msgPayloadSR.template_name}] reforço estudo`,
                  status: "open",
                  zapi_connection_id: whatsappCreds.connectionId,
                })
                .select("id")
                .single();
              convIdSR = newConvSR?.id;
            } else {
              const updateDataSR: any = {
                last_message_at: new Date().toISOString(),
                last_message_preview: `[Template ${msgPayloadSR.template_name}] reforço estudo`,
                zapi_connection_id: whatsappCreds.connectionId || undefined,
              };
              if (!existingConvSR.profile_id) {
                const { data: profileMatchSR } = await supabase
                  .from("profiles")
                  .select("id, full_name")
                  .or(`phone.eq.${phone},phone.eq.+${phone}`)
                  .maybeSingle();
                if (profileMatchSR) {
                  updateDataSR.profile_id = profileMatchSR.id;
                  updateDataSR.contact_name = profileMatchSR.full_name;
                }
              }
              await supabase.from("whatsapp_conversations").update(updateDataSR).eq("id", convIdSR);
            }

            if (convIdSR) {
              let tplMetaSR: Record<string, any> = { source: "study_reminder", template_name: msgPayloadSR.template_name };
              try {
                const { data: tplDataSR } = await supabase
                  .from("whatsapp_templates")
                  .select("components")
                  .eq("name", msgPayloadSR.template_name)
                  .maybeSingle();
                if (tplDataSR?.components && Array.isArray(tplDataSR.components)) {
                  for (const comp of tplDataSR.components as any[]) {
                    if (comp.type === "BODY" && comp.text) {
                      let body = comp.text as string;
                      parametersSR.forEach((val: string, idx: number) => {
                        body = body.replace(`{{${idx + 1}}}`, val);
                      });
                      tplMetaSR.template_body = body;
                    }
                    if (comp.type === "HEADER" && comp.text) {
                      tplMetaSR.template_header = comp.text;
                    }
                  }
                }
              } catch (tplErr) {
                console.error(`[queue-processor] Failed to resolve study reminder template body:`, tplErr);
              }

              await supabase.from("whatsapp_messages").insert({
                conversation_id: convIdSR,
                direction: "outbound",
                message_type: "template",
                content: `[Template: ${msgPayloadSR.template_name}] ${parametersSR.join(", ")}`,
                zapi_message_id: tplResponseSR?.messages?.[0]?.id || tplResponseSR?.messageId || null,
                status: "sent",
                metadata: tplMetaSR,
              });
            }

            // Timeline event
            try {
              await supabase.from("cs_timeline_events").insert({
                event_type: "study_reminder",
                event_subtype: "sent",
                user_id: item.context_data?.user_id || null,
                phone,
                channel: "whatsapp",
                summary: `Template reforço estudo enviado para ${phone}`,
                metadata: { template_name: msgPayloadSR.template_name, queue_item_id: item.id },
              });
            } catch (tlErr) {
              console.error(`[queue-processor] Timeline error:`, tlErr);
            }

            await supabase.from("whatsapp_send_queue").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              attempts: item.attempts + 1,
            }).eq("id", item.id);

            sentCount++;
            continue;
          }
        }

        // ─── retry_131042: re-send template using bindings (for payment-issue retries) ───
        if (item.context_type?.endsWith('_retry') && whatsappCreds.provider === 'era_cloud') {
          const ctxRetry = item.context_data || {};
          const templateNameRetry = ctxRetry.template_name as string | undefined;

          if (!templateNameRetry) {
            console.error(`[queue-processor] retry item ${item.id} has no template_name — skipping`);
            await supabase.from("whatsapp_send_queue").update({
              status: "failed", attempts: item.attempts + 1,
              error_message: "No template_name in retry context_data",
            }).eq("id", item.id);
            failedCount++;
            continue;
          }

          // Find the binding for this template to get variable_map
          const { data: binding } = await supabase
            .from("whatsapp_template_bindings")
            .select("variable_map")
            .eq("template_name", templateNameRetry)
            .eq("connection_id", whatsappCreds.connectionId)
            .eq("is_active", true)
            .maybeSingle();

          // Resolve variable values from profile
          const { data: profileRetry } = await supabase
            .from("profiles")
            .select("full_name")
            .or(`phone.eq.${phone},phone.eq.+${phone}`)
            .maybeSingle();

          const varMap = (binding?.variable_map || {}) as Record<string, string>;
          const variableValues: Record<string, string> = {
            student_name: profileRetry?.full_name?.split(" ")[0] || "aluno(a)",
            lead_name: profileRetry?.full_name?.split(" ")[0] || "aluno(a)",
            user_name: profileRetry?.full_name?.split(" ")[0] || "aluno(a)",
            product_name: "nosso curso",
          };
          const maxIdxRetry = Object.keys(varMap).length > 0
            ? Math.max(...Object.keys(varMap).map(Number))
            : 0;
          const parametersRetry: string[] = [];
          for (let idx = 1; idx <= maxIdxRetry; idx++) {
            const sysVar = varMap[String(idx)] || "";
            if (sysVar.startsWith("static:")) {
              parametersRetry.push(sysVar.replace("static:", ""));
            } else {
              parametersRetry.push(variableValues[sysVar] || "");
            }
          }

          try {
            const tplResponseRetry = await sendTemplateMessage(phone, templateNameRetry, parametersRetry.filter(p => p.trim()), whatsappCreds);
            console.log(`[queue-processor] Retry template '${templateNameRetry}' sent to ${phone}`);

            // Register conversation
            const { data: existingConvRetry } = await supabase
              .from("whatsapp_conversations")
              .select("id, profile_id")
              .eq("phone", phone)
              .maybeSingle();

            let convIdRetry = existingConvRetry?.id;
            if (!convIdRetry) {
              const { data: newConvRetry } = await supabase
                .from("whatsapp_conversations")
                .insert({
                  phone,
                  profile_id: profileRetry ? (await supabase.from("profiles").select("id").or(`phone.eq.${phone},phone.eq.+${phone}`).maybeSingle()).data?.id : null,
                  contact_name: profileRetry?.full_name || null,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: `[Template ${templateNameRetry}] retry`,
                  status: "open",
                  zapi_connection_id: whatsappCreds.connectionId,
                })
                .select("id")
                .single();
              convIdRetry = newConvRetry?.id;
            } else {
              await supabase.from("whatsapp_conversations").update({
                last_message_at: new Date().toISOString(),
                last_message_preview: `[Template ${templateNameRetry}] retry`,
              }).eq("id", convIdRetry);
            }

            if (convIdRetry) {
              let tplMetaRetry: Record<string, any> = { source: ctxRetry.original_source || "retry_131042", template_name: templateNameRetry };
              try {
                const { data: tplDataRetry } = await supabase
                  .from("whatsapp_templates")
                  .select("components")
                  .eq("name", templateNameRetry)
                  .maybeSingle();
                if (tplDataRetry?.components && Array.isArray(tplDataRetry.components)) {
                  for (const comp of tplDataRetry.components as any[]) {
                    if (comp.type === "BODY" && comp.text) {
                      let body = comp.text as string;
                      parametersRetry.forEach((val: string, idx: number) => {
                        body = body.replace(`{{${idx + 1}}}`, val);
                      });
                      tplMetaRetry.template_body = body;
                    }
                    if (comp.type === "HEADER" && comp.text) {
                      tplMetaRetry.template_header = comp.text;
                    }
                  }
                }
              } catch (tplErr) {
                console.error(`[queue-processor] Failed to resolve retry template body:`, tplErr);
              }

              await supabase.from("whatsapp_messages").insert({
                conversation_id: convIdRetry,
                direction: "outbound",
                message_type: "template",
                content: `[Template: ${templateNameRetry}] ${parametersRetry.join(", ")}`,
                zapi_message_id: tplResponseRetry?.messages?.[0]?.id || tplResponseRetry?.messageId || null,
                status: "sent",
                metadata: tplMetaRetry,
              });
            }

            await supabase.from("whatsapp_send_queue").update({
              status: "sent",
              sent_at: new Date().toISOString(),
              attempts: item.attempts + 1,
            }).eq("id", item.id);

            sentCount++;
          } catch (retryErr: any) {
            console.error(`[queue-processor] Retry template send failed for ${phone}:`, retryErr);
            await supabase.from("whatsapp_send_queue").update({
              status: item.attempts + 1 >= item.max_attempts ? "failed" : "pending",
              attempts: item.attempts + 1,
              error_message: retryErr.message?.substring(0, 500),
            }).eq("id", item.id);
            failedCount++;
          }
          continue;
        }

        // ─── crm_pico_blast: send approved template directly (no 24h window needed) ───
        if (item.context_type === 'crm_pico_blast' && whatsappCreds.provider === 'era_cloud') {
          const ctxPB = item.context_data || {};
          const templateNamePB = ctxPB.template_name as string | undefined;
          const templateVariablesPB = (ctxPB.variables || ctxPB.template_variables || {}) as Record<string, string>;

          if (!templateNamePB) {
            console.error(`[queue-processor] crm_pico_blast item ${item.id} has no template_name — marking as failed`);
            await supabase.from("whatsapp_send_queue").update({
              status: "failed", attempts: item.attempts + 1,
              error_message: "No template_name in context_data",
            }).eq("id", item.id);
            failedCount++;
            continue;
          }

          // Build parameters array
          const maxIdxPB = Object.keys(templateVariablesPB).length > 0
            ? Math.max(...Object.keys(templateVariablesPB).map(Number))
            : 0;
          const parametersPB: string[] = [];
          for (let idx = 1; idx <= maxIdxPB; idx++) {
            parametersPB.push(templateVariablesPB[String(idx)] || "");
          }

          const tplResponsePB = await sendTemplateMessage(phone, templateNamePB, parametersPB.filter(p => p.trim()), whatsappCreds);
          console.log(`[queue-processor] Pico blast template '${templateNamePB}' sent to ${phone} — Response:`, JSON.stringify(tplResponsePB));

          // Register conversation
          const { data: existingConvPB } = await supabase
            .from("whatsapp_conversations")
            .select("id, profile_id")
            .eq("phone", phone)
            .maybeSingle();

          let convIdPB = existingConvPB?.id;
          if (!convIdPB) {
            const { data: profilePB } = await supabase
              .from("profiles")
              .select("id, full_name")
              .or(`phone.eq.${phone},phone.eq.+${phone}`)
              .maybeSingle();
            const { data: newConvPB } = await supabase
              .from("whatsapp_conversations")
              .insert({
                phone,
                profile_id: profilePB?.id || null,
                contact_name: profilePB?.full_name || null,
                last_message_at: new Date().toISOString(),
                last_message_preview: `[Template ${templateNamePB}] pico blast`,
                status: "open",
                zapi_connection_id: whatsappCreds.connectionId,
              })
              .select("id")
              .single();
            convIdPB = newConvPB?.id;
          } else {
            const updateDataPB: any = {
              last_message_at: new Date().toISOString(),
              last_message_preview: `[Template ${templateNamePB}] pico blast`,
              zapi_connection_id: whatsappCreds.connectionId || undefined,
            };
            if (!existingConvPB.profile_id) {
              const { data: profileMatchPB } = await supabase
                .from("profiles")
                .select("id, full_name")
                .or(`phone.eq.${phone},phone.eq.+${phone}`)
                .maybeSingle();
              if (profileMatchPB) {
                updateDataPB.profile_id = profileMatchPB.id;
                updateDataPB.contact_name = profileMatchPB.full_name;
              }
            }
            await supabase.from("whatsapp_conversations").update(updateDataPB).eq("id", convIdPB);
          }

          if (convIdPB) {
            let tplMetaPB: Record<string, any> = { source: "crm_pico_blast", template_name: templateNamePB, lead_id: ctxPB.lead_id };
            try {
              const { data: tplDataPB } = await supabase
                .from("whatsapp_templates")
                .select("components")
                .eq("name", templateNamePB)
                .maybeSingle();
              if (tplDataPB?.components && Array.isArray(tplDataPB.components)) {
                for (const comp of tplDataPB.components as any[]) {
                  if (comp.type === "BODY" && comp.text) {
                    let body = comp.text as string;
                    parametersPB.forEach((val: string, idx: number) => {
                      body = body.replace(`{{${idx + 1}}}`, val);
                    });
                    tplMetaPB.template_body = body;
                  }
                  if (comp.type === "HEADER" && comp.text) {
                    tplMetaPB.template_header = comp.text;
                  }
                }
              }
            } catch (tplErr) {
              console.error(`[queue-processor] Failed to resolve pico blast template body:`, tplErr);
            }

            await supabase.from("whatsapp_messages").insert({
              conversation_id: convIdPB,
              direction: "outbound",
              message_type: "template",
              content: `[Template: ${templateNamePB}] ${parametersPB.join(", ")}`,
              zapi_message_id: tplResponsePB?.messages?.[0]?.id || tplResponsePB?.messageId || null,
              status: "sent",
              metadata: tplMetaPB,
            });
          }

          // Timeline event
          try {
            await supabase.from("cs_timeline_events").insert({
              event_type: "crm_pico_blast",
              event_subtype: "sent",
              phone,
              channel: "whatsapp",
              summary: `Template pico blast '${templateNamePB}' enviado para ${phone}`,
              metadata: { template_name: templateNamePB, lead_id: ctxPB.lead_id, queue_item_id: item.id },
            });
          } catch (tlErr) {
            console.error(`[queue-processor] Timeline error:`, tlErr);
          }

          await supabase.from("whatsapp_send_queue").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: item.attempts + 1,
          }).eq("id", item.id);

          sentCount++;
          continue;
        }

        // ─── 24h window check for generic text sends via Era Cloud ───
        if (whatsappCreds.provider === 'era_cloud' && item.context_type !== 'upsell') {
          const { data: windowConvQ } = await supabase
            .from("whatsapp_conversations")
            .select("id")
            .eq("phone", phone)
            .maybeSingle();

          let windowOpenQ = false;
          if (windowConvQ) {
            const { data: lastInboundQ } = await supabase
              .from("whatsapp_messages")
              .select("created_at")
              .eq("conversation_id", windowConvQ.id)
              .eq("direction", "inbound")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastInboundQ) {
              const elapsed = Date.now() - new Date(lastInboundQ.created_at).getTime();
              windowOpenQ = elapsed < 24 * 60 * 60 * 1000;
            }
          }

          if (!windowOpenQ) {
            console.log(`[queue-processor] 24h window closed for ${phone} (item ${item.id}) — marking as failed`);
            await supabase.from("whatsapp_send_queue").update({
              status: "failed",
              attempts: item.attempts + 1,
              error_message: "Janela de 24h fechada. Apenas templates podem ser enviados.",
            }).eq("id", item.id);
            failedCount++;
            continue;
          }
        }

        const responseData = await sendWhatsAppMessage(phone, item.message, whatsappCreds);
        console.log(`[queue-processor] Sent to ${phone} (item ${item.id}) via ${whatsappCreds.provider} — Response:`, JSON.stringify(responseData));

        // For Era Cloud upsell items: send template first to open 24h window
        let templateMessageId: string | null = null;
        let studentName = "aluno(a)";
        let productName = "nosso curso";
        
        if (whatsappCreds.provider === 'era_cloud' && item.context_type === 'upsell') {
          // Get student name and product name from context_data
          const ctx = item.context_data || {};
          if (ctx.sequence_id) {
            const { data: seq } = await supabase.from("upsell_sequences").select("user_id, product_id, product_type").eq("id", ctx.sequence_id).maybeSingle();
            if (seq) {
              const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", seq.user_id).maybeSingle();
              studentName = profile?.full_name?.split(" ")[0] || "aluno(a)";
              const table = seq.product_type === "course" ? "courses" : "packages";
              const { data: product } = await supabase.from(table).select("name").eq("id", seq.product_id).maybeSingle();
              productName = product?.name || "nosso curso";
            }
          }

          // Check if there's an open 24h window (inbound message < 24h)
          const { data: lastInbound } = await supabase
            .from("whatsapp_messages")
            .select("created_at")
            .eq("direction", "inbound")
            .in("conversation_id", (await supabase.from("whatsapp_conversations").select("id").eq("phone", phone)).data?.map((c: any) => c.id) || [])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const hasOpenWindow = lastInbound && (Date.now() - new Date(lastInbound.created_at).getTime()) < 24 * 60 * 60 * 1000;

          if (!hasOpenWindow) {
            // Fetch upsell_settings for template name
            const { data: upsellSettings } = await supabase.from("upsell_settings").select("whatsapp_template_name").limit(1).single();
            const templateName = upsellSettings?.whatsapp_template_name || 'abertura_upsell_1';

            try {
              const tplRes = await sendTemplateMessage(phone, templateName, [studentName, productName], whatsappCreds);
              templateMessageId = tplRes.messages?.[0]?.id || tplRes.messageId || null;
              console.log(`[queue-processor] Template '${templateName}' sent to ${phone} before upsell text`);
              // Wait 3 seconds for window to open
              await new Promise((resolve) => setTimeout(resolve, 3000));
            } catch (tplErr) {
              console.error(`[queue-processor] Failed to send template to ${phone}:`, tplErr);
              throw tplErr; // Let the retry logic handle it
            }
          }
        }

        // Register in conversations & messages
        const { data: existingConv } = await supabase
          .from("whatsapp_conversations")
          .select("id, profile_id")
          .eq("phone", phone)
          .maybeSingle();

        let convId = existingConv?.id;
        if (!convId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name")
            .or(`phone.eq.${phone},phone.eq.+${phone}`)
            .maybeSingle();

          const { data: newConv } = await supabase
            .from("whatsapp_conversations")
            .insert({
              phone,
              profile_id: profile?.id || null,
              contact_name: profile?.full_name || null,
              last_message_at: new Date().toISOString(),
              last_message_preview: item.message.substring(0, 100),
              status: "open",
              zapi_connection_id: whatsappCreds.connectionId,
            })
            .select("id")
            .single();
          convId = newConv?.id;
        } else {
          const updateDataGeneric: any = {
            last_message_at: new Date().toISOString(),
            last_message_preview: item.message.substring(0, 100),
            zapi_connection_id: whatsappCreds.connectionId || undefined,
          };
          if (!existingConv.profile_id) {
            const { data: profileMatchGeneric } = await supabase
              .from("profiles")
              .select("id, full_name")
              .or(`phone.eq.${phone},phone.eq.+${phone}`)
              .maybeSingle();
            if (profileMatchGeneric) {
              updateDataGeneric.profile_id = profileMatchGeneric.id;
              updateDataGeneric.contact_name = profileMatchGeneric.full_name;
            }
          }
          await supabase
            .from("whatsapp_conversations")
            .update(updateDataGeneric)
            .eq("id", convId);
        }

        if (convId) {
          // Register template message if one was sent
          if (templateMessageId) {
            // Render template body from DB
            let tplMeta: Record<string, any> = { source: "upsell_template" };
            if (whatsappCreds.connectionId) {
              const { data: upsellSettings2 } = await supabase.from("upsell_settings").select("whatsapp_template_name").limit(1).single();
              const tplName = upsellSettings2?.whatsapp_template_name || 'abertura_upsell_1';
              const { data: tplData } = await supabase
                .from("whatsapp_templates")
                .select("components")
                .eq("connection_id", whatsappCreds.connectionId)
                .eq("name", tplName)
                .maybeSingle();
              if (tplData?.components && Array.isArray(tplData.components)) {
                tplMeta.template_name = tplName;
                for (const comp of tplData.components as any[]) {
                  if (comp.type === "BODY" && comp.text) {
                    let body = comp.text as string;
                    // Replace with student/product names used earlier
                    const ctx2 = item.context_data || {};
                    body = body.replace("{{1}}", studentName || "aluno(a)").replace("{{2}}", productName || "nosso curso");
                    tplMeta.template_body = body;
                  }
                  if (comp.type === "HEADER" && comp.text) {
                    tplMeta.template_header = comp.text;
                  }
                }
              }
            }

            await supabase.from("whatsapp_messages").insert({
              conversation_id: convId,
              direction: "outbound",
              message_type: "template",
              content: `[Template abertura_upsell]`,
              zapi_message_id: templateMessageId,
              status: "sent",
              metadata: tplMeta,
            });
          }

          await supabase.from("whatsapp_messages").insert({
            conversation_id: convId,
            direction: "outbound",
            message_type: "text",
            content: item.message,
            zapi_message_id: responseData.messageId || responseData.zapiMessageId || responseData.key?.id || null,
            status: "sent",
          });
        }

        // Handle context-specific updates
        if (item.context_data) {
          const ctx = item.context_data;
          if (item.context_type === "upsell" && ctx.sequence_id) {
            await supabase
              .from("upsell_sequences")
              .update({
                whatsapp_sent: ctx.step || 1,
                last_whatsapp_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", ctx.sequence_id);

            await supabase.from("upsell_email_logs").insert({
              sequence_id: ctx.sequence_id,
              step: ctx.step || 1,
              subject: `WhatsApp Dia ${ctx.step || 1}`,
              body_html: item.message,
              sent_at: new Date().toISOString(),
              status: "sent",
              channel: "whatsapp",
            });
          }

          if (item.context_type === "welcome" && convId) {
            await supabase
              .from("whatsapp_messages")
              .update({ metadata: { source: "welcome_flow" } })
              .eq("conversation_id", convId)
              .eq("content", item.message)
              .order("created_at", { ascending: false })
              .limit(1);
          }
        }

        // Timeline event for queue processing
        try {
          await supabase.from("cs_timeline_events").insert({
            event_type: item.context_type || "unknown",
            event_subtype: "sent",
            user_id: item.context_data?.user_id || null,
            phone,
            channel: "whatsapp",
            summary: `Mensagem ${item.context_type} enviada para ${phone}`,
            metadata: {
              queue_item_id: item.id,
              context_type: item.context_type,
              provider: whatsappCreds.provider,
            },
          });
        } catch (tlErr) {
          console.error(`[queue-processor] Timeline insert error:`, tlErr);
        }

        await supabase
          .from("whatsapp_send_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: item.attempts + 1,
          })
          .eq("id", item.id);

        sentCount++;
      } catch (sendErr: any) {
        console.error(`[queue-processor] Failed to send item ${item.id}:`, sendErr);

        if (sendErr.message === "DAILY_LIMIT_REACHED") {
          await supabase
            .from("whatsapp_send_queue")
            .update({
              status: "pending",
              error_message: "Limite diário de novos contatos atingido",
              scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            })
            .eq("id", item.id);
          failedCount++;
          continue;
        }

        const newAttempts = item.attempts + 1;
        const newStatus = newAttempts >= item.max_attempts ? "failed" : "pending";

        await supabase
          .from("whatsapp_send_queue")
          .update({
            status: newStatus,
            attempts: newAttempts,
            error_message: sendErr.message || "Unknown error",
            ...(newStatus === "pending" ? { scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() } : {}),
          })
          .eq("id", item.id);

        failedCount++;
      }
    }

    console.log(`[queue-processor] Done. Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({ success: true, processed: pendingItems.length, sent: sentCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[queue-processor] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
