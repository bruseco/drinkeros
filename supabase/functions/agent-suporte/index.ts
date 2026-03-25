import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(0, 4) + "9" + digits.slice(4);
  return digits;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { conversationId, messageContent, messageType, forceInvoke, adminInstruction } = await req.json();
    if (!conversationId) throw new Error("conversationId is required");

    const { data: conversation } = await adminClient.from("whatsapp_conversations").select("*").eq("id", conversationId).single();
    if (!conversation) throw new Error("Conversation not found");

    const { data: agentSettings } = await adminClient.from("whatsapp_agent_settings").select("*").limit(1).single();
    const zapiCreds = await getZapiCredsForConversation(adminClient, conversationId);

    // Media analysis
    let enrichedContent = messageContent || "";
    const currentMsgType = messageType || "text";
    if (["image", "audio", "sticker", "video", "document"].includes(currentMsgType) && messageContent) {
      try {
        const resolvedUrl = await resolveMediaUrl(messageContent, adminClient, conversationId);
        const analysis = await analyzeMedia(LOVABLE_API_KEY, currentMsgType, resolvedUrl);
        if (analysis) {
          const labels: Record<string, string> = { image: "IMAGEM", sticker: "STICKER", video: "VÍDEO", audio: "ÁUDIO", document: "DOCUMENTO" };
          enrichedContent = `[${labels[currentMsgType] || "MÍDIA"}: ${analysis}]`;
          const { data: latestMsg } = await adminClient.from("whatsapp_messages").select("id, metadata").eq("conversation_id", conversationId).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).single();
          if (latestMsg) {
            const meta = (latestMsg.metadata && typeof latestMsg.metadata === "object") ? latestMsg.metadata : {};
            await adminClient.from("whatsapp_messages").update({ metadata: currentMsgType === "audio" ? { ...meta, ai_transcription: analysis } : { ...meta, ai_description: analysis } }).eq("id", latestMsg.id);
          }
        }
      } catch (e) { console.error("[suporte] Media error:", e); }
    }

    const { data: allMessages } = await adminClient.from("whatsapp_messages")
      .select("id, direction, content, message_type, metadata, created_at")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true });

    const conversationHistory = buildConversationHistory(allMessages || []);

    const aiCount = (allMessages || []).filter((m: any) => m.direction === "outbound").length;
    if (aiCount >= (agentSettings?.max_messages_per_conversation || 50)) {
      await adminClient.from("whatsapp_conversations").update({ agent_mode: "human", escalation_reason: "Limite atingido", escalated_at: new Date().toISOString() }).eq("id", conversationId);
      const msg = "Vou transferir você para um atendente! 😊";
      const sr = await sendWithWindowCheck(adminClient, conversationId, normalizePhone(conversation.phone), msg, zapiCreds, "suporte");
      if (sr.sent) await saveOutboundMessage(adminClient, conversationId, msg, sr.result?.messages?.[0]?.id || sr.result?.messageId || null, "agent_suporte");
      return new Response(JSON.stringify({ success: true, action: "escalated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Student context
    let studentContext = "Aluno não identificado na plataforma.";
    if (conversation.profile_id) {
      const { data: profile } = await adminClient.from("profiles").select("user_id, full_name, email, phone").eq("id", conversation.profile_id).single();
      if (profile) {
        const [{ data: userPkgs }, { data: userCourses }] = await Promise.all([
          adminClient.from("user_packages").select("package_id, packages(name)").eq("user_id", profile.user_id),
          adminClient.from("user_courses").select("course_id, courses(name)").eq("user_id", profile.user_id),
        ]);
        const enrolled = [
          ...(userCourses || []).map((c: any) => `Curso: ${c.courses?.name || c.course_id}`),
          ...(userPkgs || []).map((p: any) => `Módulo: ${p.packages?.name || p.package_id}`),
        ];
        studentContext = `DADOS DO ALUNO:\n- Nome: ${profile.full_name || "Não informado"}\n- Email: ${profile.email}\n\nPRODUTOS MATRICULADOS:\n${enrolled.length > 0 ? enrolled.join("\n") : "Nenhum"}`;
      }
    }

    const systemPrompt = `Você é o agente de SUPORTE da Criminal Lab, plataforma de cursos de Direito Criminal.

Seu papel é EXCLUSIVAMENTE prestar atendimento técnico e resolver dúvidas sobre a plataforma.

${agentSettings?.business_context || ""}

${studentContext}

LINK DA PLATAFORMA: https://alunos.criminallab.com.br
NUNCA use outros domínios. O ÚNICO link correto é https://alunos.criminallab.com.br

REGRAS:
1. Responda dúvidas sobre plataforma, acesso, problemas técnicos.
2. Se o aluno perguntar sobre NOVOS cursos ou quiser comprar: reclassifyTo: "ascensao".
3. Se detectar que é aluno novo precisando de onboarding/dados de acesso: reclassifyTo: "cs".
4. Se detectar compra pendente (carrinho, PIX, cartão): reclassifyTo: "recuperacao".
5. Reclamações graves, reembolso, questões financeiras: shouldEscalate: true.
6. Tom humano, informal, profissional. Máximo 200 palavras. Emojis moderados.
7. NUNCA use markdown. Texto puro.
8. NUNCA invente informações.
9. Se auto-reply, ignore e pergunte se está por aí.
10. NUNCA repita informações já enviadas no histórico.

Responda em JSON:
{
  "message": "texto da resposta",
  "shouldEscalate": false,
  "reclassifyTo": null,
  "reasoning": "explicação interna"
}

reclassifyTo aceita: "cs", "ascensao", "recuperacao", ou null (manter suporte).`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...(forceInvoke && adminInstruction ? [{ role: "system", content: `Instrução do administrador: ${adminInstruction}` }] : []),
          { role: "user", content: `HISTÓRICO:\n${conversationHistory}\n\n${forceInvoke ? "Administrador acionou manualmente." : `ÚLTIMA MENSAGEM:\n${enrichedContent}`}\n\nResponda em JSON.` },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429 || status === 402) return new Response(JSON.stringify({ success: false, reason: `ai_error_${status}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const rawContent = (await aiResponse.json()).choices?.[0]?.message?.content || "";
    let parsed: any;
    try { parsed = JSON.parse(rawContent); } catch { const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/); parsed = m ? JSON.parse(m[1].trim()) : { message: rawContent, shouldEscalate: false, reasoning: "fallback" }; }

    // Re-classification
    if (parsed.reclassifyTo && ["cs", "ascensao", "recuperacao"].includes(parsed.reclassifyTo)) {
      console.log(`[suporte] Reclassifying to ${parsed.reclassifyTo}: ${parsed.reasoning}`);
      await adminClient.from("whatsapp_conversations").update({ agent_type: parsed.reclassifyTo }).eq("id", conversationId);
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "agent_router", event_subtype: "reclassified", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente Suporte reclassificou para "${parsed.reclassifyTo}": ${parsed.reasoning}`, metadata: { conversation_id: conversationId, from: "suporte", to: parsed.reclassifyTo } }); } catch {}
      const agentMap: Record<string, string> = { cs: "agent-cs", ascensao: "agent-ascensao", recuperacao: "agent-recuperacao" };
      fetch(`${supabaseUrl}/functions/v1/${agentMap[parsed.reclassifyTo]}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ conversationId, messageContent, messageType, forceInvoke: true }),
      }).catch(err => console.error("[suporte] Reclassify invoke error:", err));
      return new Response(JSON.stringify({ success: true, action: "reclassified", from: "suporte", to: parsed.reclassifyTo }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (parsed.shouldEscalate) {
      await adminClient.from("whatsapp_conversations").update({ agent_mode: "human", escalation_reason: parsed.reasoning, escalated_at: new Date().toISOString() }).eq("id", conversationId);
      const msg = parsed.message || "Vou transferir você para um atendente! 😊";
      const sr = await sendWithWindowCheck(adminClient, conversationId, normalizePhone(conversation.phone), msg, zapiCreds, "suporte");
      if (sr.sent) await saveOutboundMessage(adminClient, conversationId, msg, sr.result?.messages?.[0]?.id || sr.result?.messageId || null, "agent_suporte");
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "escalated", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente Suporte escalou: ${parsed.reasoning}`, metadata: { conversation_id: conversationId, agent: "suporte" } }); } catch {}
      return new Response(JSON.stringify({ success: true, action: "escalated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sr = await sendWithWindowCheck(adminClient, conversationId, normalizePhone(conversation.phone), parsed.message, zapiCreds, "suporte");
    if (sr.sent) {
      await saveOutboundMessage(adminClient, conversationId, parsed.message, sr.result?.messages?.[0]?.id || sr.result?.messageId || null, "agent_suporte");
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "responded", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente Suporte respondeu (${parsed.message.substring(0, 60)}...)`, metadata: { conversation_id: conversationId, agent: "suporte", send_method: sr.method } }); } catch {}
    }

    return new Response(JSON.stringify({ success: true, action: sr.sent ? "replied" : "blocked", agent: "suporte" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("agent-suporte error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ========== WINDOW CHECK ==========
async function sendWithWindowCheck(adminClient: any, conversationId: string, phone: string, message: string, creds: any, agentType: string): Promise<{ sent: boolean; method: string; result?: any }> {
  if (creds.provider !== "era_cloud") { const r = await sendWhatsAppMessage(phone, message, creds); return { sent: true, method: "text", result: r }; }
  const { data: lastInbound } = await adminClient.from("whatsapp_messages").select("created_at").eq("conversation_id", conversationId).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (lastInbound && (Date.now() - new Date(lastInbound.created_at).getTime() < 24*60*60*1000)) { const r = await sendWhatsAppMessage(phone, message, creds); return { sent: true, method: "text", result: r }; }
  console.log(`[${agentType}] Window closed, attempting reabertura template`);
  const { data: conv } = await adminClient.from("whatsapp_conversations").select("zapi_connection_id, contact_name").eq("id", conversationId).single();
  if (!conv?.zapi_connection_id) return { sent: false, method: "blocked" };
  const { data: binding } = await adminClient.from("whatsapp_template_bindings").select("template_name").eq("connection_id", conv.zapi_connection_id).eq("process", "reabertura_atendimento").eq("is_active", true).limit(1).maybeSingle();
  if (!binding) return { sent: false, method: "blocked" };
  try {
    const params = [conv.contact_name || "aluno(a)", "equipe Criminal Lab"];
    const res = await fetch(`${creds.apiUrl}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": creds.token! }, body: JSON.stringify({ to: phone, type: "template", template: { name: binding.template_name, language: { code: "pt_BR" }, components: [{ type: "body", parameters: params.map(p => ({ type: "text", text: p })) }] } }) });
    const data = await res.json(); if (!res.ok) return { sent: false, method: "blocked" };
    return { sent: true, method: "template", result: data };
  } catch { return { sent: false, method: "blocked" }; }
}

// ========== SHARED HELPERS ==========
function buildConversationHistory(messages: any[]): string {
  return messages.map((m: any) => {
    const dir = m.direction === "inbound" ? "RECEBIDO" : "ENVIADO";
    const time = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const meta = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
    let contextPrefix = "";
    if (m.direction === "outbound") {
      if (meta.source === "welcome_flow") contextPrefix = "[CONFIRMAÇÃO DE MATRÍCULA] ";
      else if (meta.source === "upsell") contextPrefix = "[OFERTA AUTOMÁTICA] ";
      else if (meta.source?.startsWith("agent_")) contextPrefix = `[${meta.source.toUpperCase()}] `;
      else if (meta.source === "ai_agent") contextPrefix = "[RESPOSTA IA] ";
    }
    let display = m.content || `[${m.message_type}]`;
    if (m.message_type === "image" && meta.ai_description) display = `[IMAGEM: ${meta.ai_description}]`;
    else if (m.message_type === "audio" && meta.ai_transcription) display = `[ÁUDIO: ${meta.ai_transcription}]`;
    else if (["image", "audio", "video", "document", "sticker"].includes(m.message_type)) display = `[${m.message_type.toUpperCase()}]`;
    return `[${dir} ${time}] ${contextPrefix}${display}`;
  }).join("\n");
}

async function getZapiCredsForConversation(adminClient: any, conversationId: string) {
  const { data: conv } = await adminClient.from("whatsapp_conversations").select("zapi_connection_id").eq("id", conversationId).single();
  if (conv?.zapi_connection_id) { const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id }); if (creds?.[0]) return { provider: creds[0].provider || "zapi", instanceId: creds[0].instance_id, token: creds[0].token, securityToken: creds[0].security_token, apiUrl: creds[0].api_url, instanceName: creds[0].instance_name }; }
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID"), token = Deno.env.get("ZAPI_TOKEN"), securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN");
  if (!instanceId || !token || !securityToken) throw new Error("WhatsApp credentials not configured");
  return { provider: "zapi", instanceId, token, securityToken, apiUrl: null, instanceName: null };
}

async function sendWhatsAppMessage(phone: string, message: string, creds: any) {
  if (creds.provider === "era_cloud") { const res = await fetch(`${creds.apiUrl}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": creds.token! }, body: JSON.stringify({ to: phone, type: "text", text: { body: message } }) }); const data = await res.json(); if (!res.ok) throw new Error(`Era Cloud error: ${res.status}`); return data; }
  const res = await fetch(`https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`, { method: "POST", headers: { "Content-Type": "application/json", "Client-Token": creds.securityToken! }, body: JSON.stringify({ phone, message }) }); const data = await res.json(); if (!res.ok) throw new Error(`Z-API error: ${res.status}`); return data;
}

async function saveOutboundMessage(client: any, conversationId: string, content: string, zapiMessageId?: string | null, source = "ai_agent") {
  await client.from("whatsapp_messages").insert({ conversation_id: conversationId, direction: "outbound", message_type: "text", content, status: "sent", metadata: { source }, ...(zapiMessageId ? { zapi_message_id: zapiMessageId } : {}) });
  await client.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: content.substring(0, 100) }).eq("id", conversationId);
}

async function resolveMediaUrl(content: string, adminClient: any, conversationId: string): Promise<string> {
  if (content.startsWith("http")) return content;
  try { const { data: conv } = await adminClient.from("whatsapp_conversations").select("zapi_connection_id").eq("id", conversationId).single(); if (conv?.zapi_connection_id) { const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id }); if (creds?.[0]?.provider === "era_cloud" && creds[0].api_url && creds[0].token) { const res = await fetch(`${creds[0].api_url}/v1/media/${content}`, { headers: { "X-API-Key": creds[0].token } }); if (res.ok) { const d = await res.json(); return d.url || d.link || d.download_url || content; } } } } catch {}
  return content;
}

async function analyzeMedia(apiKey: string, mediaType: string, mediaUrl: string): Promise<string> {
  const prompts: Record<string, string> = { image: "Descreva em português (máx 100 palavras).", audio: "Transcreva em português.", sticker: "Descreva.", video: "Descreva.", document: "Resumo (máx 200 palavras)." };
  const content: any[] = [{ type: "text", text: prompts[mediaType] || prompts.image }];
  if (["image", "sticker", "video"].includes(mediaType)) content.push({ type: "image_url", image_url: { url: mediaUrl } });
  else if (mediaType === "audio") { try { const r = await fetch(mediaUrl); const buf = await r.arrayBuffer(); content.push({ type: "input_audio", input_audio: { data: btoa(String.fromCharCode(...new Uint8Array(buf))), format: mediaUrl.includes(".ogg") ? "wav" : "mp3" } }); } catch { content.push({ type: "image_url", image_url: { url: mediaUrl } }); } }
  else if (mediaType === "document") { try { const r = await fetch(mediaUrl); if (!r.ok) throw new Error("dl"); const buf = await r.arrayBuffer(); if (buf.byteLength > 10*1024*1024) return "[documento muito grande]"; const mime = r.headers.get("content-type") || "application/pdf"; content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}` } }); } catch { return "[documento: não foi possível analisar]"; } }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content }], temperature: 0.3 }) });
  if (!res.ok) return "";
  return (await res.json()).choices?.[0]?.message?.content?.trim() || "";
}
