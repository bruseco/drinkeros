import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface WhatsAppCredentials {
  provider: string;
  instanceId: string | null;
  token: string | null;
  securityToken: string | null;
  apiUrl: string | null;
  instanceName: string | null;
  connectionId: string | null;
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 1): Promise<Response> {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok || res.status < 500) return res;
    lastResponse = res;
    if (attempt < maxRetries) {
      const delay = 1000 * (attempt + 1); // 1s, 2s backoff
      console.log(`[whatsapp-send] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status ${res.status})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return lastResponse!;
}

async function sendWhatsAppTemplate(phone: string, templateName: string, parameters: string[], creds: WhatsAppCredentials): Promise<any> {
  const url = `${creds.apiUrl}/v1/messages`;
  const validParams = parameters.filter((p) => p && p.trim() !== "");
  const body: any = {
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: validParams.length > 0
        ? [{ type: "body", parameters: validParams.map((p) => ({ type: "text", text: p })) }]
        : [],
    },
  };
  console.log(`[whatsapp-send] Sending template '${templateName}' to ${phone}`, JSON.stringify(body));
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(`Erro da API WhatsApp (${res.status}): ${detail}`);
  }
  return data;
}

async function sendWhatsAppMedia(phone: string, mediaUrl: string, mediaType: string, fileName: string | undefined, creds: WhatsAppCredentials): Promise<any> {
  if (creds.provider === 'era_cloud') {
    const url = `${creds.apiUrl}/v1/messages`;
    let body: any;
    if (mediaType === 'image') {
      body = { to: phone, type: "image", image: { link: mediaUrl } };
    } else if (mediaType === 'audio') {
      body = { to: phone, type: "audio", audio: { link: mediaUrl } };
    } else {
      body = { to: phone, type: "document", document: { link: mediaUrl, filename: fileName || "document" } };
    }
    console.log(`[whatsapp-send] Sending ${mediaType} to ${phone}`);
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = data?.error?.message || data?.message || JSON.stringify(data);
      throw new Error(`Erro ao enviar mídia (${res.status}): ${detail}`);
    }
    return data;
  } else {
    throw new Error("Media sending not supported for Z-API provider");
  }
}

async function sendWhatsAppMessage(phone: string, message: string, creds: WhatsAppCredentials): Promise<any> {
  if (creds.provider === 'era_cloud') {
    const url = `${creds.apiUrl}/v1/messages`;
    console.log("[whatsapp-send] Era Cloud API URL:", url);
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
      body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = data?.error?.message || data?.message || JSON.stringify(data);
      throw new Error(`Erro ao enviar mensagem (${res.status}): ${detail}`);
    }
    return data;
  } else {
    const zapiUrl = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
    console.log("[whatsapp-send] Z-API URL:", zapiUrl);
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

async function getCredentials(
  adminClient: any,
  phone: string,
  conversationId?: string
): Promise<WhatsAppCredentials> {
  const { data: connections } = await adminClient
    .from("zapi_connections")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (!connections || connections.length === 0) {
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const token = Deno.env.get("ZAPI_TOKEN");
    const securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN");
    if (!instanceId || !token || !securityToken) throw new Error("WhatsApp credentials not configured");
    return { provider: 'zapi', instanceId, token, securityToken, apiUrl: null, instanceName: null, connectionId: null };
  }

  if (conversationId) {
    const { data: conv } = await adminClient
      .from("whatsapp_conversations")
      .select("zapi_connection_id")
      .eq("id", conversationId)
      .single();

    if (conv?.zapi_connection_id) {
      const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
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
  }

  const { data: existingConv } = await adminClient
    .from("whatsapp_conversations")
    .select("id, zapi_connection_id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();

  const isNewContact = !existingConv;

  const { data: connectionId, error: rpcError } = await adminClient
    .rpc("select_zapi_connection", {
      p_conversation_id: existingConv?.id || null,
      p_is_new_contact: isNewContact,
    });

  if (rpcError) {
    if (rpcError.message?.includes("DAILY_LIMIT_REACHED")) {
      throw new Error("Limite diário de novos contatos atingido em todas as conexões");
    }
    throw rpcError;
  }

  if (!connectionId) throw new Error("No active WhatsApp connection available");

  const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: connectionId });
  if (!creds || creds.length === 0) throw new Error("Failed to get credentials for selected connection");

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: role } = await adminClient.rpc("is_admin", { _user_id: user.id });
    if (!role) throw new Error("Forbidden: admin only");

    const { phone: rawPhone, message, conversationId, template, templateParams, mediaUrl, mediaType, fileName } = await req.json();
    if (!rawPhone || (!message && !template && !mediaUrl)) throw new Error("phone and (message, template or mediaUrl) are required");
    const phone = normalizePhone(rawPhone);

    const whatsappCreds = await getCredentials(adminClient, phone, conversationId);
    
    let responseData: any;
    let displayMessage: string;
    let msgType = 'text';
    let templateMetadata: Record<string, any> = {};

    // ─── 24h window check for non-template sends via Era Cloud ───
    if (!template && whatsappCreds.provider === 'era_cloud') {
      // Use conversationId if available, otherwise search by phone
      let windowConvId: string | null = conversationId || null;
      if (!windowConvId) {
        const { data: windowConv } = await adminClient
          .from("whatsapp_conversations")
          .select("id")
          .or(`phone.eq.${phone},phone.eq.+${phone}`)
          .maybeSingle();
        windowConvId = windowConv?.id || null;
      }

      let windowOpen = false;
      if (windowConvId) {
        const { data: lastInbound } = await adminClient
          .from("whatsapp_messages")
          .select("created_at")
          .eq("conversation_id", windowConvId)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastInbound) {
          const elapsed = Date.now() - new Date(lastInbound.created_at).getTime();
          windowOpen = elapsed < 24 * 60 * 60 * 1000;
          console.log(`[whatsapp-send] Window check: last inbound ${lastInbound.created_at}, elapsed ${Math.round(elapsed/1000)}s, open=${windowOpen}`);
        } else {
          console.log(`[whatsapp-send] Window check: no inbound messages found for conv ${windowConvId}`);
        }
      } else {
        console.log(`[whatsapp-send] Window check: no conversation found for phone ${phone}`);
      }

      if (!windowOpen) {
        return new Response(
          JSON.stringify({ error: "Janela de 24h fechada. Use um template para iniciar a conversa." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (mediaUrl && mediaType) {
      responseData = await sendWhatsAppMedia(phone, mediaUrl, mediaType, fileName, whatsappCreds);
      displayMessage = mediaUrl;
      msgType = mediaType;
    } else if (template && whatsappCreds.provider === 'era_cloud') {
      const params = templateParams || [];
      responseData = await sendWhatsAppTemplate(phone, template, params, whatsappCreds);
      displayMessage = `[Template: ${template}] ${params.join(', ')}`;
      msgType = 'template';

      if (whatsappCreds.connectionId) {
        const { data: tplData } = await adminClient
          .from("whatsapp_templates")
          .select("components")
          .eq("connection_id", whatsappCreds.connectionId)
          .eq("name", template)
          .maybeSingle();
        if (tplData?.components && Array.isArray(tplData.components)) {
          for (const comp of tplData.components as any[]) {
            if (comp.type === "BODY" && comp.text) {
              let body = comp.text as string;
              params.forEach((p: string, i: number) => { body = body.replace(`{{${i + 1}}}`, p); });
              templateMetadata.template_body = body;
            }
            if (comp.type === "HEADER" && comp.text) {
              templateMetadata.template_header = comp.text;
            }
          }
          templateMetadata.template_name = template;
        }
      }
    } else {
      if (!message) throw new Error("message is required for non-template sends");
      responseData = await sendWhatsAppMessage(phone, message, whatsappCreds);
      displayMessage = message;
    }

    console.log(`[whatsapp-send] API response:`, JSON.stringify(responseData));

    // Upsert conversation
    let convId = conversationId;
    if (!convId) {
      const { data: existing } = await adminClient
        .from("whatsapp_conversations")
        .select("id")
        .or(`phone.eq.${phone},phone.eq.+${phone}`)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("id, full_name")
          .or(`phone.eq.${phone},phone.eq.+${phone}`)
          .maybeSingle();

        const { data: newConv, error: convError } = await adminClient
          .from("whatsapp_conversations")
          .insert({
            phone,
            profile_id: profile?.id || null,
            contact_name: profile?.full_name || null,
            last_message_at: new Date().toISOString(),
            last_message_preview: displayMessage.substring(0, 100),
            status: "open",
            zapi_connection_id: whatsappCreds.connectionId,
          })
          .select("id")
          .single();

        if (convError) throw convError;
        convId = newConv.id;
      }
    }

    await adminClient
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: displayMessage.substring(0, 100),
        agent_mode: "human",
        zapi_connection_id: whatsappCreds.connectionId || undefined,
      })
      .eq("id", convId);

    const { error: msgError } = await adminClient
      .from("whatsapp_messages")
      .insert({
        conversation_id: convId,
        direction: "outbound",
        message_type: msgType,
        content: displayMessage,
        zapi_message_id: responseData.messages?.[0]?.id || responseData.messageId || responseData.zapiMessageId || responseData.key?.id || null,
        status: "sent",
        metadata: Object.keys(templateMetadata).length > 0 ? templateMetadata : undefined,
      });

    if (msgError) throw msgError;

    return new Response(JSON.stringify({ success: true, conversationId: convId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Use 502 for upstream API errors (Meta/Era Cloud), 400 for client errors
    const isUpstreamError = msg.includes("Erro da API WhatsApp") || msg.includes("Erro ao enviar mídia");
    const status = isUpstreamError ? 502 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
