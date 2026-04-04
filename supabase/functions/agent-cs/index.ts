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
          const labels: Record<string, string> = { image: "IMAGEM", audio: "ÁUDIO", sticker: "STICKER", video: "VÍDEO", document: "DOCUMENTO" };
          enrichedContent = `[${labels[currentMsgType] || "MÍDIA"}: ${analysis}]`;
          const { data: latestMsg } = await adminClient.from("whatsapp_messages").select("id, metadata").eq("conversation_id", conversationId).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).single();
          if (latestMsg) {
            const meta = (latestMsg.metadata && typeof latestMsg.metadata === "object") ? latestMsg.metadata : {};
            await adminClient.from("whatsapp_messages").update({ metadata: currentMsgType === "audio" ? { ...meta, ai_transcription: analysis } : { ...meta, ai_description: analysis } }).eq("id", latestMsg.id);
          }
        }
      } catch (e) { console.error("[cs] Media error:", e); }
    }

    // Conversation history
    const { data: allMessages } = await adminClient.from("whatsapp_messages")
      .select("id, direction, content, message_type, metadata, created_at")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true });

    const conversationHistory = buildConversationHistory(allMessages || []);

    // Max messages check
    const aiCount = (allMessages || []).filter((m: any) => m.direction === "outbound").length;
    if (aiCount >= (agentSettings?.max_messages_per_conversation || 50)) {
      await adminClient.from("whatsapp_conversations").update({ agent_mode: "human", escalation_reason: "Limite de mensagens atingido", escalated_at: new Date().toISOString() }).eq("id", conversationId);
      const msg = "Vou transferir você para um atendente! 😊";
      const sendResult = await sendWithWindowCheck(adminClient, conversationId, normalizePhone(conversation.phone), msg, zapiCreds, "cs");
      if (sendResult.sent) await saveOutboundMessage(adminClient, conversationId, sendResult.method === "template" ? `[Template reabertura] ${msg}` : msg, sendResult.result?.messages?.[0]?.id || sendResult.result?.messageId || null, "agent_cs");
      return new Response(JSON.stringify({ success: true, action: "escalated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rich student context for CS agent
    let studentContext = "Aluno não identificado na plataforma.";
    let tempPassword: string | null = null;

    // Check welcome queue for temp password
    const cleanPhone = conversation.phone.replace(/\D/g, "");
    const phoneVariants = [cleanPhone, `+${cleanPhone}`];
    if (cleanPhone.length === 13 && cleanPhone.startsWith("55")) phoneVariants.push(cleanPhone.slice(0, 4) + cleanPhone.slice(5));
    else if (cleanPhone.length === 12 && cleanPhone.startsWith("55")) phoneVariants.push(cleanPhone.slice(0, 4) + "9" + cleanPhone.slice(4));

    const { data: welcomeData } = await adminClient.from("whatsapp_welcome_queue").select("temporary_password, email")
      .eq("is_new_user", true).in("phone", phoneVariants).not("temporary_password", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    tempPassword = welcomeData?.temporary_password || null;

    if (conversation.profile_id) {
      const { data: profile } = await adminClient.from("profiles").select("user_id, full_name, email, phone").eq("id", conversation.profile_id).single();
      if (profile) {
        const [{ data: userCombos }, { data: userCourses }, { data: userPkgs }, { data: comboCourseLinks }, { data: coursePackageLinks }, { data: views }] = await Promise.all([
          adminClient.from("user_combos").select("combo_id, combos(name)").eq("user_id", profile.user_id),
          adminClient.from("user_courses").select("course_id, courses(name)").eq("user_id", profile.user_id),
          adminClient.from("user_packages").select("package_id, packages(name)").eq("user_id", profile.user_id),
          adminClient.from("combo_courses").select("combo_id, course_id"),
          adminClient.from("course_packages").select("course_id, package_id"),
          adminClient.from("recipe_views").select("recipe_id, completed").eq("user_id", profile.user_id),
        ]);

        const totalViewed = (views || []).length;
        const totalCompleted = (views || []).filter((v: any) => v.completed).length;

        const ownedComboIds = new Set((userCombos || []).map((uc: any) => uc.combo_id));
        const ownedCourseIds = new Set((userCourses || []).map((uc: any) => uc.course_id));
        const courseIdsInCombos = new Set((comboCourseLinks || []).filter((cc: any) => ownedComboIds.has(cc.combo_id)).map((cc: any) => cc.course_id));
        const standaloneCourseIds = new Set([...ownedCourseIds].filter((cid) => !courseIdsInCombos.has(cid)));
        const packageIdsInCourses = new Set((coursePackageLinks || []).filter((cp: any) => ownedCourseIds.has(cp.course_id)).map((cp: any) => cp.package_id));
        const ownedPkgIds = new Set((userPkgs || []).map((up: any) => up.package_id));
        const standalonePackageIds = new Set([...ownedPkgIds].filter((pid) => !packageIdsInCourses.has(pid)));

        const enrolledList: string[] = [];
        for (const uc of (userCombos || [])) {
          const name = (uc as any).combos?.name || uc.combo_id;
          const count = (comboCourseLinks || []).filter((cc: any) => cc.combo_id === uc.combo_id).length;
          enrolledList.push(`Combo: ${name} (${count} cursos)`);
        }
        for (const uc of (userCourses || [])) { if (standaloneCourseIds.has(uc.course_id)) enrolledList.push(`Curso: ${(uc as any).courses?.name || uc.course_id}`); }
        for (const up of (userPkgs || [])) { if (standalonePackageIds.has(up.package_id)) enrolledList.push(`Módulo: ${(up as any).packages?.name || up.package_id}`); }

        studentContext = `DADOS DO ALUNO:
- Nome: ${profile.full_name || "Não informado"}
- Email: ${profile.email}
- Telefone: ${profile.phone || conversation.phone}
${tempPassword ? `- SENHA TEMPORÁRIA: ${tempPassword}` : ""}

PRODUTOS MATRICULADOS:
${enrolledList.length > 0 ? enrolledList.join("\n") : "Nenhum"}

PROGRESSO:
- Aulas visualizadas: ${totalViewed}
- Aulas concluídas: ${totalCompleted}`;
      }
    }

    const systemPrompt = `Você é o agente de CUSTOMER SUCCESS (CS) da Drinkeros, plataforma de cursos de Direito Criminal.

Seu papel é fazer o ONBOARDING de novos alunos e garantir a CONTINUIDADE dos estudos.

${agentSettings?.business_context || ""}

${studentContext}

LINK DA PLATAFORMA: https://alunos.criminallab.com.br
NUNCA use outros domínios. O ÚNICO link correto é https://alunos.criminallab.com.br

REGRAS:
1. Quando houver [CONFIRMAÇÃO DE MATRÍCULA] no histórico recente, o aluno ACABOU de ser matriculado. Responda com: boas-vindas, produtos matriculados (combo/curso), link https://alunos.criminallab.com.br, email de login, senha temporária, e ofereça ajuda. MAS se já enviou no histórico, NÃO repita.
2. Incentive o aluno a estudar. Pergunte sobre progresso.
3. Se o aluno perguntar sobre NOVOS cursos para comprar, reclassifique: reclassifyTo: "ascensao".
4. Problemas técnicos complexos: reclassifique para "suporte" (reclassifyTo: "suporte").
5. Se detectar que o aluno tem um carrinho abandonado ou mencionou compra pendente: reclassifyTo: "recuperacao".
6. Tom humano, informal, profissional. Máximo 200 palavras. Emojis moderados.
7. NUNCA use markdown. Texto puro.
8. Se auto-reply, ignore e pergunte se está por aí.
9. NUNCA repita informações já enviadas no histórico.

Responda em JSON:
{
  "message": "texto da resposta",
  "shouldEscalate": false,
  "reclassifyTo": null,
  "reasoning": "explicação interna"
}

reclassifyTo aceita: "ascensao", "recuperacao", "suporte", ou null (manter CS).`;

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

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    let parsed: any;
    try { parsed = JSON.parse(rawContent); } catch { const m = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/); parsed = m ? JSON.parse(m[1].trim()) : { message: rawContent, shouldEscalate: false, reasoning: "fallback" }; }

    // === RE-CLASSIFICATION CHECK ===
    if (parsed.reclassifyTo && ["ascensao", "recuperacao", "suporte"].includes(parsed.reclassifyTo)) {
      console.log(`[cs] Reclassifying to ${parsed.reclassifyTo}: ${parsed.reasoning}`);
      await adminClient.from("whatsapp_conversations").update({ agent_type: parsed.reclassifyTo }).eq("id", conversationId);
      try {
        await adminClient.from("cs_timeline_events").insert({
          event_type: "agent_router", event_subtype: "reclassified",
          user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp",
          summary: `Agente CS reclassificou para "${parsed.reclassifyTo}": ${parsed.reasoning}`,
          metadata: { conversation_id: conversationId, from: "cs", to: parsed.reclassifyTo },
        });
      } catch {}
      const agentMap: Record<string, string> = { ascensao: "agent-ascensao", recuperacao: "agent-recuperacao", suporte: "agent-suporte" };
      fetch(`${supabaseUrl}/functions/v1/${agentMap[parsed.reclassifyTo]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ conversationId, messageContent, messageType, forceInvoke: true }),
      }).catch(err => console.error("[cs] Reclassify invoke error:", err));
      return new Response(JSON.stringify({ success: true, action: "reclassified", from: "cs", to: parsed.reclassifyTo }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (parsed.shouldEscalate) {
      await adminClient.from("whatsapp_conversations").update({ agent_mode: "human", escalation_reason: parsed.reasoning, escalated_at: new Date().toISOString() }).eq("id", conversationId);
      const msg = parsed.message || "Vou te transferir para um atendente! 😊";
      const sendResult = await sendWithWindowCheck(adminClient, conversationId, normalizePhone(conversation.phone), msg, zapiCreds, "cs");
      if (sendResult.sent) await saveOutboundMessage(adminClient, conversationId, msg, sendResult.result?.messages?.[0]?.id || sendResult.result?.messageId || null, "agent_cs");
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "escalated", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente CS escalou: ${parsed.reasoning}`, metadata: { conversation_id: conversationId, agent: "cs" } }); } catch {}
      return new Response(JSON.stringify({ success: true, action: "escalated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send response with window check
    const sendResult = await sendWithWindowCheck(adminClient, conversationId, normalizePhone(conversation.phone), parsed.message, zapiCreds, "cs");
    if (sendResult.sent) {
      await saveOutboundMessage(adminClient, conversationId, parsed.message, sendResult.result?.messages?.[0]?.id || sendResult.result?.messageId || null, "agent_cs");
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "responded", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente CS respondeu (${parsed.message.substring(0, 60)}...)`, metadata: { conversation_id: conversationId, agent: "cs", send_method: sendResult.method } }); } catch {}
    } else {
      console.log(`[cs] Message blocked (window closed, no template). Message: ${parsed.message.substring(0, 80)}`);
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "blocked", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente CS bloqueado: janela 24h fechada`, metadata: { conversation_id: conversationId, agent: "cs", intended_message: parsed.message.substring(0, 200) } }); } catch {}
    }

    return new Response(JSON.stringify({ success: true, action: sendResult.sent ? "replied" : "blocked", agent: "cs", method: sendResult.method }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("agent-cs error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ========== WINDOW CHECK HELPER ==========

async function sendWithWindowCheck(
  adminClient: any, conversationId: string, phone: string, message: string,
  creds: any, agentType: string
): Promise<{ sent: boolean; method: string; result?: any }> {
  // Z-API: no window restrictions
  if (creds.provider !== "era_cloud") {
    const result = await sendWhatsAppMessage(phone, message, creds);
    return { sent: true, method: "text", result };
  }

  // Check 24h window
  const { data: lastInbound } = await adminClient
    .from("whatsapp_messages").select("created_at")
    .eq("conversation_id", conversationId).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (lastInbound) {
    const elapsed = Date.now() - new Date(lastInbound.created_at).getTime();
    if (elapsed < 24 * 60 * 60 * 1000) {
      const result = await sendWhatsAppMessage(phone, message, creds);
      return { sent: true, method: "text", result };
    }
  }

  // Window closed — try reabertura template
  console.log(`[${agentType}] Window closed for ${phone}, attempting reabertura template`);
  const { data: conv } = await adminClient.from("whatsapp_conversations")
    .select("zapi_connection_id, contact_name").eq("id", conversationId).single();

  if (!conv?.zapi_connection_id) return { sent: false, method: "blocked" };

  const { data: binding } = await adminClient.from("whatsapp_template_bindings")
    .select("template_name, variable_map")
    .eq("connection_id", conv.zapi_connection_id)
    .eq("process", "reabertura_atendimento").eq("is_active", true)
    .limit(1).maybeSingle();

  if (!binding) return { sent: false, method: "blocked" };

  try {
    const params = [conv.contact_name || "aluno(a)", "equipe Drinkeros"];
    const url = `${creds.apiUrl}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
      body: JSON.stringify({
        to: phone, type: "template",
        template: { name: binding.template_name, language: { code: "pt_BR" },
          components: [{ type: "body", parameters: params.map(p => ({ type: "text", text: p })) }] },
      }),
    });
    const data = await res.json();
    if (!res.ok) { console.error(`[${agentType}] Template error:`, data); return { sent: false, method: "blocked" }; }
    console.log(`[${agentType}] Sent reabertura template instead of text`);
    return { sent: true, method: "template", result: data };
  } catch (e) { console.error(`[${agentType}] Template error:`, e); return { sent: false, method: "blocked" }; }
}

// ========== SHARED HELPERS ==========

function buildConversationHistory(messages: any[]): string {
  return messages.map((m: any) => {
    const dir = m.direction === "inbound" ? "RECEBIDO" : "ENVIADO";
    const time = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const meta = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
    let prefix = "";
    if (m.direction === "outbound") {
      if (meta.source === "welcome_flow") prefix = "[CONFIRMAÇÃO DE MATRÍCULA] ";
      else if (meta.source === "welcome_credentials") prefix = "[CREDENCIAIS DE ACESSO] ";
      else if (meta.source?.startsWith("agent_")) prefix = `[${meta.source.toUpperCase()}] `;
      else if (meta.source === "ai_agent") prefix = "[RESPOSTA IA] ";
    }
    let display = m.content || `[${m.message_type}]`;
    if (m.message_type === "image" && meta.ai_description) display = `[IMAGEM: ${meta.ai_description}]`;
    else if (m.message_type === "audio" && meta.ai_transcription) display = `[ÁUDIO: ${meta.ai_transcription}]`;
    else if (["image", "audio", "video", "document", "sticker"].includes(m.message_type)) display = `[${m.message_type.toUpperCase()}]`;
    return `[${dir} ${time}] ${prefix}${display}`;
  }).join("\n");
}

async function getZapiCredsForConversation(adminClient: any, conversationId: string) {
  const { data: conv } = await adminClient.from("whatsapp_conversations").select("zapi_connection_id").eq("id", conversationId).single();
  if (conv?.zapi_connection_id) {
    const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
    if (creds?.[0]) return { provider: creds[0].provider || "zapi", instanceId: creds[0].instance_id, token: creds[0].token, securityToken: creds[0].security_token, apiUrl: creds[0].api_url, instanceName: creds[0].instance_name };
  }
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID"), token = Deno.env.get("ZAPI_TOKEN"), securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN");
  if (!instanceId || !token || !securityToken) throw new Error("WhatsApp credentials not configured");
  return { provider: "zapi", instanceId, token, securityToken, apiUrl: null, instanceName: null };
}

async function sendWhatsAppMessage(phone: string, message: string, creds: any) {
  if (creds.provider === "era_cloud") {
    const res = await fetch(`${creds.apiUrl}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": creds.token! }, body: JSON.stringify({ to: phone, type: "text", text: { body: message } }) });
    const data = await res.json(); if (!res.ok) throw new Error(`Era Cloud error: ${res.status}`); return data;
  }
  const res = await fetch(`https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`, { method: "POST", headers: { "Content-Type": "application/json", "Client-Token": creds.securityToken! }, body: JSON.stringify({ phone, message }) });
  const data = await res.json(); if (!res.ok) throw new Error(`Z-API error: ${res.status}`); return data;
}

async function saveOutboundMessage(client: any, conversationId: string, content: string, zapiMessageId?: string | null, source = "ai_agent") {
  await client.from("whatsapp_messages").insert({ conversation_id: conversationId, direction: "outbound", message_type: "text", content, status: "sent", metadata: { source }, ...(zapiMessageId ? { zapi_message_id: zapiMessageId } : {}) });
  await client.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: content.substring(0, 100) }).eq("id", conversationId);
}

async function resolveMediaUrl(content: string, adminClient: any, conversationId: string): Promise<string> {
  if (content.startsWith("http")) return content;
  try {
    const { data: conv } = await adminClient.from("whatsapp_conversations").select("zapi_connection_id").eq("id", conversationId).single();
    if (conv?.zapi_connection_id) {
      const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
      if (creds?.[0]?.provider === "era_cloud" && creds[0].api_url && creds[0].token) {
        const res = await fetch(`${creds[0].api_url}/v1/media/${content}`, { headers: { "X-API-Key": creds[0].token } });
        if (res.ok) { const data = await res.json(); return data.url || data.link || data.download_url || content; }
      }
    }
  } catch {}
  return content;
}

async function analyzeMedia(apiKey: string, mediaType: string, mediaUrl: string): Promise<string> {
  const prompts: Record<string, string> = { image: "Descreva esta imagem em português (máx 100 palavras).", audio: "Transcreva este áudio em português.", sticker: "Descreva este sticker.", video: "Descreva este vídeo.", document: "Resumo deste documento (máx 200 palavras)." };
  const content: any[] = [{ type: "text", text: prompts[mediaType] || prompts.image }];
  if (["image", "sticker", "video"].includes(mediaType)) content.push({ type: "image_url", image_url: { url: mediaUrl } });
  else if (mediaType === "audio") {
    try { const r = await fetch(mediaUrl); const buf = await r.arrayBuffer(); content.push({ type: "input_audio", input_audio: { data: btoa(String.fromCharCode(...new Uint8Array(buf))), format: mediaUrl.includes(".ogg") ? "wav" : "mp3" } }); } catch { content.push({ type: "image_url", image_url: { url: mediaUrl } }); }
  } else if (mediaType === "document") {
    try { const r = await fetch(mediaUrl); if (!r.ok) throw new Error("dl"); const buf = await r.arrayBuffer(); if (buf.byteLength > 10*1024*1024) return "[documento muito grande]"; const mime = r.headers.get("content-type") || "application/pdf"; content.push({ type: "image_url", image_url: { url: `data:${mime};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}` } }); } catch { return "[documento: não foi possível analisar]"; }
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content }], temperature: 0.3 }) });
  if (!res.ok) return "";
  return (await res.json()).choices?.[0]?.message?.content?.trim() || "";
}
