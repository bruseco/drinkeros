import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, messageContent, messageType, messageTimestamp, forceInvoke, adminInstruction } = await req.json();
    if (!conversationId) throw new Error("conversationId is required");

    // === DEBOUNCE: Wait 30s to batch multiple messages (skip if forceInvoke) ===
    if (!forceInvoke) {
      const BATCH_WAIT_SECONDS = 30;
      console.log(`[router] Received message for ${conversationId}, waiting ${BATCH_WAIT_SECONDS}s...`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_WAIT_SECONDS * 1000));

      if (messageTimestamp) {
        const { data: newerMessages } = await adminClient
          .from("whatsapp_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound")
          .gt("created_at", messageTimestamp)
          .limit(1);

        if (newerMessages && newerMessages.length > 0) {
          console.log(`[router] Newer messages found, skipping this invocation`);
          return new Response(JSON.stringify({ success: true, action: "skipped_debounce" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 1. Get agent settings
    const { data: agentSettings } = await adminClient
      .from("whatsapp_agent_settings")
      .select("*")
      .limit(1)
      .single();

    if (!forceInvoke && !agentSettings?.is_enabled) {
      return new Response(JSON.stringify({ success: false, reason: "agent_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get conversation
    const { data: conversation } = await adminClient
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (!forceInvoke && (!conversation || conversation.agent_mode !== "ai")) {
      return new Response(JSON.stringify({ success: false, reason: "not_ai_mode" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversation) {
      return new Response(JSON.stringify({ success: false, reason: "conversation_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Keyword escalation check (fast, before LLM)
    const lowerContent = (messageContent || "").toLowerCase();
    const keywords: string[] = agentSettings.escalation_keywords || [];
    const keywordMatch = keywords.find((kw: string) => lowerContent.includes(kw.toLowerCase()));

    if (keywordMatch) {
      const zapiCreds = await getZapiCredsForConversation(adminClient, conversationId);
      await adminClient.from("whatsapp_conversations").update({
        agent_mode: "human",
        escalation_reason: `Palavra-chave detectada: "${keywordMatch}"`,
        escalated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      const transitionMsg = "Entendi! Vou transferir você para um dos nossos atendentes. Em breve alguém da equipe vai te responder 😊";
      const sendResult = await sendWhatsAppMessage(normalizePhone(conversation.phone), transitionMsg, zapiCreds);
      const msgId = sendResult?.messages?.[0]?.id || sendResult?.messageId || null;
      await saveOutboundMessage(adminClient, conversationId, transitionMsg, msgId, "agent_router");

      return new Response(JSON.stringify({ success: true, action: "escalated", reason: keywordMatch }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Gather context for classification
    const cleanPhone = conversation.phone.replace(/\D/g, "");

    // Check CRM lead, profile, recent enrollment in parallel
    const [
      { data: crmLead },
      { data: profile },
      { data: recentMessages },
    ] = await Promise.all([
      adminClient.from("crm_leads").select("id, stage, product_name")
        .not("stage", "in", "(convertido,perdido)")
        .or(`phone.like.%${cleanPhone}%,phone.like.%${cleanPhone.slice(-10)}%`)
        .limit(1)
        .maybeSingle(),
      conversation.profile_id
        ? adminClient.from("profiles").select("user_id, full_name").eq("id", conversation.profile_id).single()
        : Promise.resolve({ data: null }),
      adminClient.from("whatsapp_messages")
        .select("direction, content, metadata, message_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const isStudent = !!profile?.data?.user_id;
    const hasCrmLead = !!crmLead;
    const hasRecentWelcome = (recentMessages || []).some((m: any) =>
      m.direction === "outbound" && m.metadata?.source === "welcome_flow"
    );
    const hasRecentCredentials = (recentMessages || []).some((m: any) =>
      m.direction === "outbound" && m.metadata?.source === "welcome_credentials"
    );

    // 5. If conversation already has agent_type and it's a follow-up, keep same agent
    // BUT: if conversation has been idle for 2+ hours, re-classify (topic may have changed)
    if (conversation.agent_type && !forceInvoke) {
      const lastOutbound = (recentMessages || []).find((m: any) => m.direction === "outbound");
      const lastOutboundTime = lastOutbound ? new Date(lastOutbound.created_at).getTime() : 0;
      const idleMs = Date.now() - lastOutboundTime;
      const IDLE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours

      if (idleMs < IDLE_THRESHOLD) {
        console.log(`[router] Conversation ${conversationId} already routed to ${conversation.agent_type}, maintaining (idle ${Math.round(idleMs/60000)}min)`);
        await invokeAgent(supabaseUrl, supabaseServiceKey, conversation.agent_type, {
          conversationId, messageContent, messageType, messageTimestamp, forceInvoke, adminInstruction,
        });
        return new Response(JSON.stringify({ success: true, action: "routed", agent: conversation.agent_type, reason: "existing_assignment" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[router] Conversation ${conversationId} idle for ${Math.round(idleMs/60000)}min, re-classifying from ${conversation.agent_type}`);
    }

    // 6. LLM-based intent classification
    const classificationContext = `
CONTEXTO DO CONTATO:
- É aluno matriculado: ${isStudent ? "SIM" : "NÃO"}
- Tem lead CRM ativo: ${hasCrmLead ? `SIM (estágio: ${crmLead?.stage}, produto: ${crmLead?.product_name})` : "NÃO"}
- Recebeu mensagem de boas-vindas recentemente: ${hasRecentWelcome || hasRecentCredentials ? "SIM" : "NÃO"}
- Últimas mensagens do contato: ${(recentMessages || []).filter((m: any) => m.direction === "inbound").slice(0, 3).map((m: any) => `"${(m.content || "").substring(0, 100)}"`).join(", ") || "nenhuma"}

MENSAGEM ATUAL:
"${(messageContent || "").substring(0, 500)}"
`;

    const classificationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um classificador de intenções para um sistema de atendimento via WhatsApp de uma plataforma de drinks e coquetéis (Drinkeros).

Classifique a mensagem do contato em UMA das 4 categorias:

- "cs": Customer Success / Onboarding — quando o contato é um aluno novo precisando de orientação de acesso, dados de login, continuidade de estudos, ou quando acabou de receber boas-vindas/confirmação de matrícula. Priorize esta categoria se o contato recebeu boas-vindas recentemente.
- "ascensao": Upsell / Ascensão — quando o contato é aluno e demonstra interesse em NOVOS cursos/produtos, pede recomendações, ou pergunta sobre outros conteúdos disponíveis.
- "recuperacao": Recuperação de Vendas — quando o contato tem um lead CRM ativo (carrinho abandonado, PIX pendente, cartão recusado) e está respondendo sobre uma compra não finalizada.
- "suporte": Suporte Geral — dúvidas técnicas sobre a plataforma, problemas de acesso, reclamações, ou qualquer assunto que não se encaixe nas categorias acima. Esta é a categoria padrão quando não há clareza.

REGRAS:
1. Se há lead CRM ativo e a mensagem parece ser resposta sobre compra → "recuperacao"
2. Se recebeu boas-vindas recentemente e é aluno novo → "cs"
3. Se é aluno e pergunta sobre novos cursos → "ascensao"
4. Na dúvida → "suporte"`,
          },
          { role: "user", content: classificationContext },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_intent",
              description: "Classifica a intenção da mensagem do contato",
              parameters: {
                type: "object",
                properties: {
                  agent_type: {
                    type: "string",
                    enum: ["cs", "ascensao", "recuperacao", "suporte"],
                    description: "Tipo do agente especializado",
                  },
                  reasoning: {
                    type: "string",
                    description: "Breve justificativa da classificação",
                  },
                },
                required: ["agent_type", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_intent" } },
        temperature: 0.1,
      }),
    });

    let agentType = "suporte"; // fallback
    let reasoning = "fallback padrão";

    if (classificationResponse.ok) {
      const classData = await classificationResponse.json();
      const toolCall = classData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          agentType = args.agent_type || "suporte";
          reasoning = args.reasoning || "";
          console.log(`[router] LLM classified as "${agentType}": ${reasoning}`);
        } catch {
          console.warn("[router] Failed to parse LLM classification, using fallback");
        }
      }
    } else {
      console.error(`[router] LLM classification failed (${classificationResponse.status}), using fallback "suporte"`);
    }

    // 7. Update conversation with agent_type
    await adminClient.from("whatsapp_conversations").update({
      agent_type: agentType,
    }).eq("id", conversationId);

    // 8. Log classification in timeline
    try {
      await adminClient.from("cs_timeline_events").insert({
        event_type: "agent_router",
        event_subtype: "classified",
        user_id: conversation.profile_id || null,
        phone: conversation.phone,
        channel: "whatsapp",
        summary: `Gestor roteou conversa para agente "${agentType}": ${reasoning}`,
        metadata: { conversation_id: conversationId, agent_type: agentType, reasoning },
      });
    } catch (tlErr) { console.error("[router] Timeline error:", tlErr); }

    // 9. Invoke specialized agent
    await invokeAgent(supabaseUrl, supabaseServiceKey, agentType, {
      conversationId, messageContent, messageType, messageTimestamp, forceInvoke, adminInstruction,
    });

    return new Response(JSON.stringify({ success: true, action: "routed", agent: agentType, reasoning }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("agent-router error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function invokeAgent(
  supabaseUrl: string,
  serviceKey: string,
  agentType: string,
  payload: any,
) {
  const agentMap: Record<string, string> = {
    cs: "agent-cs",
    ascensao: "agent-ascensao",
    recuperacao: "agent-recuperacao",
    suporte: "agent-suporte",
  };
  const functionName = agentMap[agentType] || "agent-suporte";
  console.log(`[router] Invoking ${functionName} for conversation ${payload.conversationId}`);

  // Fire-and-forget to the specialized agent
  fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  }).catch((err) => console.error(`[router] Error invoking ${functionName}:`, err));
}

// ========== SHARED HELPERS ==========

async function getZapiCredsForConversation(adminClient: any, conversationId: string) {
  const { data: conv } = await adminClient
    .from("whatsapp_conversations")
    .select("zapi_connection_id")
    .eq("id", conversationId)
    .single();

  if (conv?.zapi_connection_id) {
    const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
    if (creds && creds.length > 0) {
      return {
        provider: creds[0].provider || "zapi",
        instanceId: creds[0].instance_id,
        token: creds[0].token,
        securityToken: creds[0].security_token,
        apiUrl: creds[0].api_url,
        instanceName: creds[0].instance_name,
      };
    }
  }

  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN");
  if (!instanceId || !token || !securityToken) throw new Error("WhatsApp credentials not configured");
  return { provider: "zapi", instanceId, token, securityToken, apiUrl: null, instanceName: null };
}

async function sendWhatsAppMessage(phone: string, message: string, creds: any) {
  if (creds.provider === "era_cloud") {
    const url = `${creds.apiUrl}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
      body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Era Cloud API error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  } else {
    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": creds.securityToken! },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Z-API error: ${res.status} ${JSON.stringify(data)}`);
    return data;
  }
}

async function saveOutboundMessage(client: any, conversationId: string, content: string, zapiMessageId?: string | null, source = "ai_agent") {
  await client.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    message_type: "text",
    content,
    status: "sent",
    metadata: { source },
    ...(zapiMessageId ? { zapi_message_id: zapiMessageId } : {}),
  });
  await client.from("whatsapp_conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: content.substring(0, 100),
  }).eq("id", conversationId);
}
