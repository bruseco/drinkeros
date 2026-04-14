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

const CACHE_TTL_DAYS = 7;

async function getCachedOrScrape(supabase: any, productType: string, productId: string, checkoutUrl: string): Promise<string> {
  const { data: cached } = await supabase.from("upsell_sales_page_cache").select("scraped_content, scraped_at").eq("product_type", productType).eq("product_id", productId).single();
  if (cached?.scraped_content) {
    const age = (Date.now() - new Date(cached.scraped_at).getTime()) / (1000 * 60 * 60 * 24);
    if (age < CACHE_TTL_DAYS) return cached.scraped_content;
  }
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY || !checkoutUrl) return "";
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", { method: "POST", headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: checkoutUrl, formats: ["markdown"], onlyMainContent: true }) });
    if (r.ok) {
      const d = await r.json();
      const content = (d?.data?.markdown || d?.markdown || "").substring(0, 3000);
      await supabase.from("upsell_sales_page_cache").upsert({ product_type: productType, product_id: productId, checkout_url: checkoutUrl, scraped_content: content, scraped_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "product_type,product_id" });
      return content;
    }
    return cached?.scraped_content || "";
  } catch { return cached?.scraped_content || ""; }
}

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
        if (analysis) enrichedContent = `[${currentMsgType.toUpperCase()}: ${analysis}]`;
      } catch {}
    }

    // Conversation history
    const { data: allMessages } = await adminClient.from("whatsapp_messages")
      .select("id, direction, content, message_type, metadata, created_at")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true });

    const conversationHistory = buildConversationHistory(allMessages || []);

    // Max messages check
    const aiCount = (allMessages || []).filter((m: any) => m.direction === "outbound").length;
    if (aiCount >= (agentSettings?.max_messages_per_conversation || 50)) {
      await adminClient.from("whatsapp_conversations").update({ agent_mode: "human", escalation_reason: "Limite atingido", escalated_at: new Date().toISOString() }).eq("id", conversationId);
      const msg = "Vou te transferir para um atendente! 😊";
      const r = await sendWhatsAppMessage(normalizePhone(conversation.phone), msg, zapiCreds);
      await saveOutboundMessage(adminClient, conversationId, msg, r?.messages?.[0]?.id || r?.messageId || null, "agent_ascensao");
      return new Response(JSON.stringify({ success: true, action: "escalated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Student context with available products for upsell
    let studentContext = "Aluno não identificado.";
    if (conversation.profile_id) {
      const { data: profile } = await adminClient.from("profiles").select("user_id, full_name, email").eq("id", conversation.profile_id).single();
      if (profile) {
        const [{ data: userPkgs }, { data: userCourses }, { data: userCombos }, { data: sellablePkgs }, { data: sellableCourses }, { data: upsellRules }, { data: views }] = await Promise.all([
          adminClient.from("user_packages").select("package_id, packages(name)").eq("user_id", profile.user_id),
          adminClient.from("user_courses").select("course_id, courses(name)").eq("user_id", profile.user_id),
          adminClient.from("user_combos").select("combo_id, combos(name)").eq("user_id", profile.user_id),
          adminClient.from("packages").select("id, name, description, hotmart_product_code").eq("is_active", true).eq("is_available_for_sale", true).eq("is_free", false),
          adminClient.from("courses").select("id, name, description, hotmart_product_code").eq("is_active", true).eq("is_available_for_sale", true).eq("is_free", false),
          adminClient.from("upsell_product_rules").select("*").eq("is_active", true).order("priority", { ascending: true }),
          adminClient.from("recipe_views").select("recipe_id, completed").eq("user_id", profile.user_id),
        ]);

        const ownedPkgIds = new Set((userPkgs || []).map((p: any) => p.package_id));
        const ownedCourseIds = new Set((userCourses || []).map((c: any) => c.course_id));
        const ownedComboIds = new Set((userCombos || []).map((c: any) => c.combo_id));

        const owned = [
          ...(userCombos || []).map((c: any) => `Combo: ${c.combos?.name}`),
          ...(userCourses || []).map((c: any) => `Curso: ${c.courses?.name}`),
        ];

        const available = [
          ...(sellablePkgs || []).filter((p: any) => !ownedPkgIds.has(p.id)).map((p: any) => `Módulo: ${p.name} - ${p.description || ""}`),
          ...(sellableCourses || []).filter((c: any) => !ownedCourseIds.has(c.id)).map((c: any) => `Curso: ${c.name} - ${c.description || ""}`),
        ];

        // Build recommended products based on upsell rules
        const recommended: string[] = [];
        for (const rule of (upsellRules || [])) {
          const triggerOwned = rule.trigger_product_type === "package" ? ownedPkgIds.has(rule.trigger_product_id) : ownedCourseIds.has(rule.trigger_product_id);
          const offerOwned = rule.offer_product_type === "package" ? ownedPkgIds.has(rule.offer_product_id) : ownedCourseIds.has(rule.offer_product_id);
          if (triggerOwned && !offerOwned) {
            const offerList = rule.offer_product_type === "package" ? (sellablePkgs || []) : (sellableCourses || []);
            const offer = offerList.find((p: any) => p.id === rule.offer_product_id);
            if (offer) recommended.push(`${offer.name} (baseado no que o aluno já tem)`);
          }
        }

        const totalViewed = (views || []).length;
        const totalCompleted = (views || []).filter((v: any) => v.completed).length;

        studentContext = `DADOS DO ALUNO:
- Nome: ${profile.full_name || "Não informado"}
- Email: ${profile.email}

PRODUTOS QUE JÁ TEM:
${owned.length > 0 ? owned.join("\n") : "Nenhum"}

PROGRESSO: ${totalViewed} aulas visualizadas, ${totalCompleted} concluídas

RECOMENDAÇÕES BASEADAS EM REGRAS DE AFINIDADE:
${recommended.length > 0 ? recommended.join("\n") : "Sem recomendações específicas"}

TODOS OS PRODUTOS DISPONÍVEIS PARA VENDA:
${available.length > 0 ? available.join("\n") : "Nenhum"}`;
      }
    }

    // First LLM call
    const systemPrompt = `Você é o agente de ASCENSÃO (Upsell) da Drinkeros, plataforma de drinks e coquetéis.

Seu papel é recomendar NOVOS cursos e produtos ao aluno de forma natural e consultiva.

${agentSettings?.business_context || ""}

${studentContext}

LINK DA PLATAFORMA: https://alunos.criminallab.com.br
NUNCA use outros domínios. O ÚNICO link correto é https://alunos.criminallab.com.br

PRIORIDADE DE OFERTA:
1. SEMPRE ofereça PRIMEIRO os produtos listados em "RECOMENDAÇÕES BASEADAS EM REGRAS DE AFINIDADE"
2. Somente se não houver recomendações, ou o aluno recusar, ofereça outros produtos da lista "TODOS OS PRODUTOS DISPONÍVEIS"
3. NUNCA ofereça um produto que o aluno já possui

REGRAS:
1. Recomende produtos baseados no perfil do aluno, seguindo a PRIORIDADE DE OFERTA acima.
2. Seja consultivo, NÃO agressivo. Entenda o que o aluno busca antes de oferecer.
3. Se precisar de mais info sobre um produto (preço, conteúdo detalhado), use needsMoreInfo: true e productQuery com o nome.
4. Se o aluno não quiser comprar, respeite. Se demonstrar desinteresse claro, informe que está tudo bem.
5. Para questões técnicas/suporte: escale (shouldEscalate: true, reasoning: "questão técnica").
6. Tom humano, informal, profissional. Máximo 200 palavras. Emojis moderados.
7. NUNCA use markdown. Texto puro.
8. NUNCA invente preços ou conteúdos.

Responda em JSON:
{
  "message": "texto",
  "shouldEscalate": false,
  "needsMoreInfo": false,
  "productQuery": "",
  "reasoning": "explicação"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          ...(forceInvoke && adminInstruction ? [{ role: "system", content: `Instrução: ${adminInstruction}` }] : []),
          { role: "user", content: `HISTÓRICO:\n${conversationHistory}\n\n${forceInvoke ? "Administrador acionou." : `ÚLTIMA MENSAGEM:\n${enrichedContent}`}\n\nJSON:` },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429 || status === 402) return new Response(JSON.stringify({ success: false, reason: `ai_error_${status}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const raw = (await aiResponse.json()).choices?.[0]?.message?.content || "";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/); parsed = m ? JSON.parse(m[1].trim()) : { message: raw, shouldEscalate: false, reasoning: "fallback" }; }

    // Handle needsMoreInfo: scrape sales page
    if (parsed.needsMoreInfo && parsed.productQuery) {
      console.log(`[ascensao] Needs more info: "${parsed.productQuery}"`);
      const cleaned = (parsed.productQuery as string).replace(/^(Curso|Módulo|Modulo)\s*/i, "").replace(/\s*\(.*?\)/g, "").trim();
      const keywords = cleaned.split(/\s+/).filter((w: string) => w.length >= 4);

      let matches: any[] = [];
      const [{ data: pkgs }, { data: courses }] = await Promise.all([
        adminClient.from("packages").select("id, name, hotmart_product_code, description").ilike("name", `%${cleaned}%`).limit(3),
        adminClient.from("courses").select("id, name, hotmart_product_code, description").ilike("name", `%${cleaned}%`).limit(3),
      ]);
      matches = [...(pkgs || []).map((p: any) => ({ ...p, type: "package" })), ...(courses || []).map((c: any) => ({ ...c, type: "course" }))];

      if (matches.length === 0 && keywords.length > 0) {
        for (const kw of keywords) {
          const [{ data: kp }, { data: kc }] = await Promise.all([
            adminClient.from("packages").select("id, name, hotmart_product_code, description").ilike("name", `%${kw}%`).limit(3),
            adminClient.from("courses").select("id, name, hotmart_product_code, description").ilike("name", `%${kw}%`).limit(3),
          ]);
          const km = [...(kp || []).map((p: any) => ({ ...p, type: "package" })), ...(kc || []).map((c: any) => ({ ...c, type: "course" }))];
          if (km.length > 0) { matches = km; break; }
        }
      }

      let salesContent = "", matchedProduct: any = null;
      for (const m of matches) {
        if (m.hotmart_product_code) {
          const url = m.hotmart_product_code.startsWith("http") ? m.hotmart_product_code : `https://pay.hotmart.com/${m.hotmart_product_code}`;
          salesContent = await getCachedOrScrape(adminClient, m.type, m.id, url);
          if (salesContent) { matchedProduct = m; break; }
        }
      }

      if (salesContent && matchedProduct) {
        const r2 = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-5.2",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `HISTÓRICO:\n${conversationHistory}\n\nÚLTIMA MENSAGEM:\n${messageContent}\n\nINFO DO PRODUTO "${matchedProduct.name}":\n${salesContent}\n\nResponda em JSON.` },
            ],
            temperature: 0.7,
          }),
        });
        if (r2.ok) {
          const raw2 = (await r2.json()).choices?.[0]?.message?.content || "";
          try { parsed = JSON.parse(raw2.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim()); } catch {}
        }
      } else {
        parsed.shouldEscalate = true;
        parsed.reasoning = `Produto "${parsed.productQuery}" não encontrado`;
      }
    }

    if (parsed.shouldEscalate) {
      await adminClient.from("whatsapp_conversations").update({ agent_mode: "human", escalation_reason: parsed.reasoning, escalated_at: new Date().toISOString() }).eq("id", conversationId);
      const msg = parsed.message || "Vou te encaminhar para alguém que pode te ajudar melhor! 😊";
      const r = await sendWhatsAppMessage(normalizePhone(conversation.phone), msg, zapiCreds);
      await saveOutboundMessage(adminClient, conversationId, msg, r?.messages?.[0]?.id || r?.messageId || null, "agent_ascensao");
      try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "escalated", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente Ascensão escalou: ${parsed.reasoning}`, metadata: { conversation_id: conversationId, agent: "ascensao" } }); } catch {}
      return new Response(JSON.stringify({ success: true, action: "escalated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await sendWhatsAppMessage(normalizePhone(conversation.phone), parsed.message, zapiCreds);
    await saveOutboundMessage(adminClient, conversationId, parsed.message, r?.messages?.[0]?.id || r?.messageId || null, "agent_ascensao");
    try { await adminClient.from("cs_timeline_events").insert({ event_type: "whatsapp_agent", event_subtype: "responded", user_id: conversation.profile_id, phone: conversation.phone, channel: "whatsapp", summary: `Agente Ascensão respondeu (${parsed.message.substring(0, 60)}...)`, metadata: { conversation_id: conversationId, agent: "ascensao" } }); } catch {}

    return new Response(JSON.stringify({ success: true, action: "replied", agent: "ascensao" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("agent-ascensao error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ========== SHARED HELPERS ==========

function buildConversationHistory(messages: any[]): string {
  return messages.map((m: any) => {
    const dir = m.direction === "inbound" ? "RECEBIDO" : "ENVIADO";
    const time = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const meta = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
    let prefix = "";
    if (m.direction === "outbound" && meta.source) {
      if (meta.source === "welcome_flow") prefix = "[MATRÍCULA] ";
      else if (meta.source === "upsell") prefix = "[OFERTA] ";
      else if (meta.source?.startsWith("agent_")) prefix = `[${meta.source.toUpperCase()}] `;
    }
    let display = m.content || `[${m.message_type}]`;
    if (m.message_type !== "text" && !m.content?.startsWith("[")) display = `[${m.message_type.toUpperCase()}]`;
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
      if (creds?.[0]?.provider === "era_cloud" && creds[0].api_url) {
        const res = await fetch(`${creds[0].api_url}/v1/media/${content}`, { headers: { "X-API-Key": creds[0].token } });
        if (res.ok) { const d = await res.json(); return d.url || d.link || content; }
      }
    }
  } catch {}
  return content;
}

async function analyzeMedia(apiKey: string, mediaType: string, mediaUrl: string): Promise<string> {
  const prompts: Record<string, string> = { image: "Descreva em português (máx 100 palavras).", audio: "Transcreva em português.", sticker: "Descreva.", video: "Descreva.", document: "Resumo (máx 200 palavras)." };
  const content: any[] = [{ type: "text", text: prompts[mediaType] || prompts.image }];
  if (["image", "sticker", "video"].includes(mediaType)) content.push({ type: "image_url", image_url: { url: mediaUrl } });
  else if (mediaType === "audio") { try { const r = await fetch(mediaUrl); const buf = await r.arrayBuffer(); content.push({ type: "input_audio", input_audio: { data: btoa(String.fromCharCode(...new Uint8Array(buf))), format: "mp3" } }); } catch { content.push({ type: "image_url", image_url: { url: mediaUrl } }); } }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content }], temperature: 0.3 }) });
  if (!res.ok) return "";
  return (await res.json()).choices?.[0]?.message?.content?.trim() || "";
}
