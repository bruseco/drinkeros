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

const CACHE_TTL_DAYS = 7;

async function getCachedOrScrape(
  supabase: any,
  productType: string,
  productId: string,
  checkoutUrl: string
): Promise<string> {
  const { data: cached } = await supabase
    .from("upsell_sales_page_cache")
    .select("scraped_content, scraped_at")
    .eq("product_type", productType)
    .eq("product_id", productId)
    .single();

  if (cached?.scraped_content) {
    const scraped = new Date(cached.scraped_at);
    const age = (Date.now() - scraped.getTime()) / (1000 * 60 * 60 * 24);
    if (age < CACHE_TTL_DAYS) {
      console.log(`[agent] Using cached sales page for ${productType}/${productId}`);
      return cached.scraped_content;
    }
  }

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY || !checkoutUrl) return "";

  try {
    console.log(`[agent] Scraping sales page: ${checkoutUrl}`);
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: checkoutUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (scrapeResponse.ok) {
      const scrapeData = await scrapeResponse.json();
      const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      const content = markdown.substring(0, 3000);

      await supabase
        .from("upsell_sales_page_cache")
        .upsert({
          product_type: productType,
          product_id: productId,
          checkout_url: checkoutUrl,
          scraped_content: content,
          scraped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "product_type,product_id" });

      return content;
    }
    return cached?.scraped_content || "";
  } catch {
    return cached?.scraped_content || "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      console.log(`[agent] Received message for ${conversationId}, waiting ${BATCH_WAIT_SECONDS}s for more messages...`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_WAIT_SECONDS * 1000));

      // After waiting, check if newer inbound messages arrived after our trigger
      if (messageTimestamp) {
        const { data: newerMessages } = await adminClient
          .from("whatsapp_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound")
          .gt("created_at", messageTimestamp)
          .limit(1);

        if (newerMessages && newerMessages.length > 0) {
          console.log(`[agent] Newer messages found after ${messageTimestamp}, skipping this invocation (another will handle it)`);
          return new Response(JSON.stringify({ success: true, action: "skipped_debounce" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      console.log(`[agent] No newer messages found, proceeding to respond`);
    } else {
      console.log(`[agent] ForceInvoke for ${conversationId}, skipping debounce`);
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

    // Get Z-API credentials for this conversation
    const zapiCreds = await getZapiCredsForConversation(adminClient, conversationId);

    // 3. Check keyword triggers first (fast check before AI call)
    const lowerContent = (messageContent || "").toLowerCase();
    const keywords: string[] = agentSettings.escalation_keywords || [];
    const keywordMatch = keywords.find((kw: string) => lowerContent.includes(kw.toLowerCase()));

    if (keywordMatch) {
      await adminClient.from("whatsapp_conversations").update({
        agent_mode: "human",
        escalation_reason: `Palavra-chave detectada: "${keywordMatch}"`,
        escalated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      const transitionMsg = "Entendi! Vou transferir você para um dos nossos atendentes. Em breve alguém da equipe vai te responder 😊";
      const kwSendResult = await sendWhatsAppMessage(normalizePhone(conversation.phone), transitionMsg, zapiCreds);
      const kwMessageId = kwSendResult?.messages?.[0]?.id || kwSendResult?.messageId || null;
      await saveOutboundMessage(adminClient, conversationId, transitionMsg, kwMessageId);

      return new Response(JSON.stringify({ success: true, action: "escalated", reason: keywordMatch }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Analyze media if needed (image/audio)
    let enrichedContent = messageContent || "";
    const currentMsgType = messageType || "text";

    if (["image", "audio", "sticker", "video", "document"].includes(currentMsgType) && messageContent) {
      console.log(`[agent] Analyzing ${currentMsgType} media: ${messageContent}`);
      try {
        // Resolve media URL if content is an ID (not a URL)
        const resolvedMediaUrl = await resolveMediaUrl(messageContent, adminClient, conversationId);
        console.log(`[agent] Resolved media URL: ${resolvedMediaUrl}`);
        const mediaAnalysis = await analyzeMedia(LOVABLE_API_KEY, currentMsgType, resolvedMediaUrl);
        if (mediaAnalysis) {
          // Save analysis to the latest inbound message metadata
          const { data: latestMsg } = await adminClient
            .from("whatsapp_messages")
            .select("id, metadata")
            .eq("conversation_id", conversationId)
            .eq("direction", "inbound")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (latestMsg) {
            const existingMeta = (latestMsg.metadata && typeof latestMsg.metadata === "object") ? latestMsg.metadata : {};
          const metaUpdate = currentMsgType === "audio"
              ? { ...existingMeta, ai_transcription: mediaAnalysis }
              : { ...existingMeta, ai_description: mediaAnalysis };
            await adminClient.from("whatsapp_messages").update({ metadata: metaUpdate }).eq("id", latestMsg.id);
          }

          const mediaLabels: Record<string, string> = {
            image: "IMAGEM",
            sticker: "STICKER",
            video: "VÍDEO",
            audio: "ÁUDIO",
            document: "DOCUMENTO",
          };
          const label = mediaLabels[currentMsgType] || "MÍDIA";
          enrichedContent = `[${label}: ${mediaAnalysis}]`;
          console.log(`[agent] Media analysis result: ${enrichedContent.substring(0, 200)}`);
        }
      } catch (mediaErr) {
        console.error(`[agent] Media analysis error:`, mediaErr);
        const errorLabels: Record<string, string> = {
          audio: "[ÁUDIO: não foi possível transcrever]",
          image: "[IMAGEM: não foi possível analisar]",
          sticker: "[STICKER: não foi possível analisar]",
          video: "[VÍDEO: não foi possível analisar]",
          document: "[DOCUMENTO: não foi possível analisar]",
        };
        enrichedContent = errorLabels[currentMsgType] || "[MÍDIA: não foi possível analisar]";
      }
    }

    // 4b. Load full conversation history
    const { data: allMessages } = await adminClient
      .from("whatsapp_messages")
      .select("id, direction, content, message_type, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const conversationHistory = (allMessages || []).map((m: any) => {
      const dir = m.direction === "inbound" ? "RECEBIDO" : "ENVIADO";
      const time = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const meta = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
      
      // Enrich with metadata context for AI understanding
      let contextPrefix = "";
      if (m.direction === "outbound") {
        if (meta.source === "welcome_flow") {
          contextPrefix = "[CONFIRMAÇÃO DE MATRÍCULA] ";
        } else if (meta.source === "upsell") {
          contextPrefix = "[OFERTA AUTOMÁTICA] ";
        } else if (meta.source === "ai_agent") {
          contextPrefix = "[RESPOSTA IA] ";
        }
      }
      
      let displayContent = m.content || `[${m.message_type}]`;
      if (m.message_type === "image" && meta.ai_description) {
        displayContent = `[IMAGEM: ${meta.ai_description}]`;
      } else if (m.message_type === "sticker" && meta.ai_description) {
        displayContent = `[FIGURINHA: ${meta.ai_description}]`;
      } else if (m.message_type === "audio" && meta.ai_transcription) {
        displayContent = `[ÁUDIO: ${meta.ai_transcription}]`;
      } else if (m.message_type === "image") {
        displayContent = "[IMAGEM: sem análise disponível]";
      } else if (m.message_type === "sticker") {
        displayContent = "[FIGURINHA: sem análise disponível]";
      } else if (m.message_type === "audio") {
        displayContent = "[ÁUDIO: sem transcrição disponível]";
      } else if (m.message_type === "video" && meta.ai_description) {
        displayContent = `[VÍDEO: ${meta.ai_description}]`;
      } else if (m.message_type === "document" && meta.ai_description) {
        displayContent = `[DOCUMENTO: ${meta.ai_description}]`;
      } else if (m.message_type === "video") {
        displayContent = "[VÍDEO: sem análise disponível]";
      } else if (m.message_type === "document") {
        displayContent = "[DOCUMENTO: sem análise disponível]";
      }
      return `[${dir} ${time}] ${contextPrefix}${displayContent}`;
    }).join("\n");

    // Check max messages limit
    const aiMessageCount = (allMessages || []).filter((m: any) => m.direction === "outbound").length;
    if (aiMessageCount >= agentSettings.max_messages_per_conversation) {
      await adminClient.from("whatsapp_conversations").update({
        agent_mode: "human",
        escalation_reason: "Limite de mensagens automáticas atingido",
        escalated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      const limitMsg = "Vou transferir você para um dos nossos atendentes para continuar te ajudando da melhor forma! 😊";
      const limitSendResult = await sendWhatsAppMessage(conversation.phone, limitMsg, zapiCreds);
      const limitMessageId = limitSendResult?.messages?.[0]?.id || limitSendResult?.messageId || null;
      await saveOutboundMessage(adminClient, conversationId, limitMsg, limitMessageId);

      return new Response(JSON.stringify({ success: true, action: "escalated", reason: "max_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Load student context
    let studentContext = "Aluno não identificado na plataforma.";
    
    // 5a. Buscar senha temporária da fila de welcome
    const cleanPhoneForWelcome = conversation.phone.replace(/\D/g, "");
    const phoneVariants = [cleanPhoneForWelcome, `+${cleanPhoneForWelcome}`];
    // Try with and without the extra 9 digit
    if (cleanPhoneForWelcome.length === 13 && cleanPhoneForWelcome.startsWith("55")) {
      phoneVariants.push(cleanPhoneForWelcome.slice(0, 4) + cleanPhoneForWelcome.slice(5));
    } else if (cleanPhoneForWelcome.length === 12 && cleanPhoneForWelcome.startsWith("55")) {
      phoneVariants.push(cleanPhoneForWelcome.slice(0, 4) + "9" + cleanPhoneForWelcome.slice(4));
    }
    
    const { data: welcomeData } = await adminClient
      .from("whatsapp_welcome_queue")
      .select("temporary_password, email")
      .eq("is_new_user", true)
      .in("phone", phoneVariants)
      .not("temporary_password", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const tempPassword = welcomeData?.temporary_password || null;
    if (tempPassword) {
      console.log(`[agent] Found temporary password for phone ${conversation.phone}`);
    }
    
    if (conversation.profile_id) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .eq("id", conversation.profile_id)
        .single();

      if (profile) {
        // Fetch all enrollment data in parallel
        const [
          { data: userCombos },
          { data: userCourses },
          { data: userPkgs },
          { data: comboCourseLinks },
          { data: coursePackageLinks },
          { data: views },
          { data: upsellSeqs },
          { data: sellablePackages },
          { data: sellableCourses },
        ] = await Promise.all([
          adminClient.from("user_combos").select("combo_id, combos(name)").eq("user_id", profile.user_id),
          adminClient.from("user_courses").select("course_id, courses(name)").eq("user_id", profile.user_id),
          adminClient.from("user_packages").select("package_id, packages(name)").eq("user_id", profile.user_id),
          adminClient.from("combo_courses").select("combo_id, course_id"),
          adminClient.from("course_packages").select("course_id, package_id"),
          adminClient.from("recipe_views").select("recipe_id, completed").eq("user_id", profile.user_id),
          adminClient.from("upsell_sequences").select("product_type, product_id, status, whatsapp_sent").eq("user_id", profile.user_id).eq("status", "active"),
          adminClient.from("packages").select("id, name, description").eq("is_active", true).eq("is_available_for_sale", true).eq("is_free", false),
          adminClient.from("courses").select("id, name, description").eq("is_active", true).eq("is_available_for_sale", true).eq("is_free", false),
        ]);

        const totalViewed = (views || []).length;
        const totalCompleted = (views || []).filter((v: any) => v.completed).length;

        // Build hierarchical enrollment context
        const ownedComboIds = new Set((userCombos || []).map((uc: any) => uc.combo_id));
        const ownedCourseIds = new Set((userCourses || []).map((uc: any) => uc.course_id));
        const ownedPkgIds = new Set((userPkgs || []).map((up: any) => up.package_id));

        // Find course IDs that belong to owned combos
        const courseIdsInCombos = new Set(
          (comboCourseLinks || [])
            .filter((cc: any) => ownedComboIds.has(cc.combo_id))
            .map((cc: any) => cc.course_id)
        );

        // Standalone courses = owned courses NOT belonging to any owned combo
        const standaloneCourseIds = new Set(
          [...ownedCourseIds].filter((cid) => !courseIdsInCombos.has(cid))
        );

        // Find package IDs that belong to any owned course (including combo courses)
        const packageIdsInCourses = new Set(
          (coursePackageLinks || [])
            .filter((cp: any) => ownedCourseIds.has(cp.course_id))
            .map((cp: any) => cp.package_id)
        );

        // Standalone packages = owned packages NOT belonging to any owned course
        const standalonePackageIds = new Set(
          [...ownedPkgIds].filter((pid) => !packageIdsInCourses.has(pid))
        );

        const enrolledList: string[] = [];
        for (const uc of (userCombos || [])) {
          const comboName = (uc as any).combos?.name || uc.combo_id;
          const courseCount = (comboCourseLinks || []).filter((cc: any) => cc.combo_id === uc.combo_id).length;
          enrolledList.push(`Combo: ${comboName} (inclui ${courseCount} curso${courseCount !== 1 ? 's' : ''})`);
        }
        for (const uc of (userCourses || [])) {
          if (standaloneCourseIds.has(uc.course_id)) {
            enrolledList.push(`Curso: ${(uc as any).courses?.name || uc.course_id}`);
          }
        }
        for (const up of (userPkgs || [])) {
          if (standalonePackageIds.has(up.package_id)) {
            enrolledList.push(`Módulo: ${(up as any).packages?.name || up.package_id}`);
          }
        }

        const availableProducts = [
          ...(sellablePackages || []).filter((p: any) => !ownedPkgIds.has(p.id)).map((p: any) => `Módulo: ${p.name} - ${p.description || ""}`),
          ...(sellableCourses || []).filter((c: any) => !ownedCourseIds.has(c.id)).map((c: any) => `Curso: ${c.name} - ${c.description || ""}`),
        ];

        studentContext = `
DADOS DO ALUNO:
- Nome: ${profile.full_name || "Não informado"}
- Email: ${profile.email}
- Telefone: ${profile.phone || conversation.phone}
${tempPassword ? `- SENHA TEMPORÁRIA: ${tempPassword}` : ""}

PRODUTOS MATRICULADOS:
${enrolledList.length > 0 ? enrolledList.join("\n") : "Nenhum"}

PROGRESSO:
- Aulas visualizadas: ${totalViewed}
- Aulas concluídas: ${totalCompleted}

${(upsellSeqs || []).length > 0 ? `OFERTA ATIVA (Máquina de Ascensão): Sim - ${(upsellSeqs || []).length} sequência(s) ativa(s). Se o aluno perguntar sobre a oferta, pode dar mais detalhes naturalmente.` : "OFERTA ATIVA: Nenhuma"}

PRODUTOS DISPONÍVEIS PARA VENDA (que o aluno NÃO possui):
${availableProducts.length > 0 ? availableProducts.join("\n") : "Nenhum produto disponível para oferta"}
`.trim();
      }
    } else {
      const cleanPhone = conversation.phone.replace(/\D/g, "");
      const { data: profileByPhone } = await adminClient
        .from("profiles")
        .select("id")
        .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
        .maybeSingle();

      if (profileByPhone) {
        await adminClient.from("whatsapp_conversations").update({
          profile_id: profileByPhone.id,
        }).eq("id", conversationId);
        studentContext = "Aluno identificado pelo telefone (dados carregando).";
      }
    }

    // 6. Call GPT-5.2 via Lovable AI Gateway
    const systemPrompt = `${agentSettings.system_prompt}

CONTEXTO DA EMPRESA:
${agentSettings.business_context}

${studentContext}

REGRAS IMPORTANTES:
1. Responda dúvidas sobre cursos, aulas, módulos e a plataforma Drinkeros.
2. Se o aluno demonstrar interesse em novos produtos, recomende naturalmente com base nos produtos disponíveis listados acima.
3. Se NÃO souber responder algo sobre um curso ou módulo específico, retorne needsMoreInfo: true e productQuery com o nome do produto. NÃO escale para humano ainda.
4. Para reclamações graves, pedidos de reembolso, questões financeiras, ameaças legais ou problemas técnicos complexos: SEMPRE escale (shouldEscalate: true).
5. Mantenha tom humano, informal mas profissional. Pareça uma pessoa real.
6. Máximo 200 palavras por mensagem.
7. Use emojis moderadamente (1-3 por mensagem).
8. NUNCA invente informações sobre cursos ou preços. Se não souber, use needsMoreInfo para buscar.
9. Se o aluno disser que não quer mais receber mensagens, respeite e escale para humano.
10. NUNCA use formatação markdown na resposta. Nada de asteriscos, traços, hashtags ou qualquer marcação de texto. Escreva texto puro e natural como uma pessoa escreveria no WhatsApp.
11. Quando houver uma [CONFIRMAÇÃO DE MATRÍCULA] no histórico recente, o aluno ACABOU de ser matriculado. Ele JÁ é aluno. NUNCA pergunte qual curso ou se quer se inscrever. Responda com TODAS estas informações obrigatoriamente:
   a) Boas-vindas calorosas usando o nome do aluno (pegue da seção DADOS DO ALUNO)
   b) Informe os produtos matriculados (pegue da seção PRODUTOS MATRICULADOS). Mencione o nome do combo ou curso, NAO liste módulos individuais se eles pertencem a um curso ou combo
   c) Informe o link de acesso: alunos.criminallab.com.br
   d) Informe o email de login (pegue da seção DADOS DO ALUNO)
   e) Se houver SENHA TEMPORÁRIA nos DADOS DO ALUNO, informe diretamente ao aluno. Caso contrário, diga que a senha foi enviada por email (se for aluno novo) ou que pode usar a senha já cadastrada (se for aluno existente)
   f) Ofereça ajuda caso tenha dificuldade para acessar
   Porem, se voce ja enviou essas informacoes em uma mensagem anterior no historico (verifique as mensagens ENVIADO), NAO repita. Apenas confirme que os dados ja foram enviados e ofereca ajuda.
12. Se o aluno enviar uma mensagem que parece ser resposta automática do celular (ex: "não estamos disponíveis", "estou ausente", "resposta automática", "agradecemos sua mensagem"), IGNORE essa mensagem e responda com uma mensagem curta e amigável perguntando se o aluno está por aí. NÃO trate auto-replies como perguntas reais.
13. NUNCA repita informacoes que ja foram enviadas no historico da conversa. Antes de informar dados de acesso, senha temporaria, link de login ou qualquer dado que ja conste em mensagens ENVIADO anteriores, apenas referencie que ja foram enviados. Exemplo: "Seus dados de acesso ja foram enviados logo acima! Se precisar de ajuda para acessar, e so me chamar."

Responda SEMPRE em formato JSON válido:
{
  "message": "texto da resposta para o aluno",
  "shouldEscalate": false,
  "needsMoreInfo": false,
  "productQuery": "",
  "crmAction": null,
  "crmLostReason": "",
  "reasoning": "breve explicação interna da sua decisão"
}

Use needsMoreInfo: true quando precisar de mais detalhes sobre um curso/módulo específico para responder ao aluno. Nesse caso, coloque o nome do curso/módulo em productQuery.

AÇÃO CRM - PERDA AUTOMÁTICA:
Se o contato disser que NÃO quer mais receber mensagens, que não tem interesse, pedir para sair da base, cancelar, ou demonstrar claramente desinteresse em comprar, retorne:
- crmAction: "mark_lost"
- crmLostReason: motivo resumido (ex: "Cliente informou desinteresse", "Pediu para sair da base", "Cancelou interesse na compra")
Isso só se aplica a leads do CRM (pessoas que ainda não compraram). Se for um aluno matriculado reclamando, use shouldEscalate: true.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          ...(forceInvoke && adminInstruction ? [{ role: "system", content: `Instrução do administrador: ${adminInstruction}` }] : []),
          {
            role: "user",
            content: `HISTÓRICO COMPLETO DA CONVERSA:\n${conversationHistory}\n\n${forceInvoke ? "O administrador acionou você manualmente para continuar o atendimento. Leia todo o histórico e dê continuidade à conversa." : `ÚLTIMA MENSAGEM DO ALUNO:\n${enrichedContent}`}\n\nGere a resposta adequada em JSON.`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429 || status === 402) {
        console.error(`AI rate limited (${status}), skipping auto-reply`);
        return new Response(JSON.stringify({ success: false, reason: `ai_error_${status}` }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let parsed: { message: string; shouldEscalate: boolean; needsMoreInfo?: boolean; productQuery?: string; crmAction?: string; crmLostReason?: string; reasoning: string };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        parsed = { message: rawContent, shouldEscalate: false, reasoning: "fallback parse" };
      }
    }

    // === HANDLE CRM MARK_LOST ACTION ===
    if (parsed.crmAction === "mark_lost") {
      try {
        const cleanPhone = conversation.phone.replace(/\D/g, "");
        const { data: crmLeads } = await adminClient.from("crm_leads").select("id")
          .not("stage", "in", "(convertido,perdido)")
          .or(`phone.like.%${cleanPhone}%,phone.like.%${cleanPhone.slice(-10)}%`);
        if (crmLeads && crmLeads.length > 0) {
          for (const lead of crmLeads) {
            await adminClient.from("crm_leads").update({
              stage: "perdido",
              lost_reason: parsed.crmLostReason || "Desinteresse detectado pelo agente IA",
            }).eq("id", lead.id);
            await adminClient.from("crm_lead_activities").insert({
              lead_id: lead.id, activity_type: "stage_change",
              description: `Marcado como perdido pelo agente IA: ${parsed.crmLostReason || "desinteresse"}`,
              metadata: { source: "whatsapp-agent", phone: conversation.phone, conversation_id: conversationId },
            });
          }
          console.log(`[agent] Marked ${crmLeads.length} CRM lead(s) as lost for phone ${cleanPhone}`);
        }
      } catch (crmErr) {
        console.error("[agent] CRM mark_lost error:", crmErr);
      }
    }

    // 6b. Handle needsMoreInfo: scrape sales page before escalating
    if (parsed.needsMoreInfo && parsed.productQuery) {
      console.log(`[agent] AI needs more info about: "${parsed.productQuery}". Searching products...`);

      // Extract keywords from productQuery for flexible matching
      // Remove prefixes like "Curso/Modulo" and suffixes like "(Lei 8.072/90)"
      const rawQuery = parsed.productQuery as string;
      const cleanedQuery = rawQuery
        .replace(/^(Curso|Módulo|Modulo|Curso\/Módulo|Curso\/Modulo)\s*/i, "")
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim();
      const keywords = cleanedQuery.split(/\s+/).filter((w: string) => w.length >= 4);
      
      console.log(`[agent] Product search - raw: "${rawQuery}", cleaned: "${cleanedQuery}", keywords: [${keywords.join(", ")}]`);

      // First try exact ilike, then fallback to keyword-based search
      let allMatches: any[] = [];
      
      const [{ data: matchedPkgs }, { data: matchedCourses }] = await Promise.all([
        adminClient.from("packages").select("id, name, checkout_url, description").ilike("name", `%${cleanedQuery}%`).limit(3),
        adminClient.from("courses").select("id, name, checkout_url, description").ilike("name", `%${cleanedQuery}%`).limit(3),
      ]);

      allMatches = [
        ...(matchedPkgs || []).map((p: any) => ({ ...p, type: "package" })),
        ...(matchedCourses || []).map((c: any) => ({ ...c, type: "course" })),
      ];

      // If no results with cleaned query, try individual keywords
      if (allMatches.length === 0 && keywords.length > 0) {
        console.log(`[agent] No results with cleaned query, trying keyword search...`);
        for (const keyword of keywords) {
          const [{ data: kwPkgs }, { data: kwCourses }] = await Promise.all([
            adminClient.from("packages").select("id, name, checkout_url, description").ilike("name", `%${keyword}%`).limit(3),
            adminClient.from("courses").select("id, name, checkout_url, description").ilike("name", `%${keyword}%`).limit(3),
          ]);
          const kwMatches = [
            ...(kwPkgs || []).map((p: any) => ({ ...p, type: "package" })),
            ...(kwCourses || []).map((c: any) => ({ ...c, type: "course" })),
          ];
          if (kwMatches.length > 0) {
            allMatches = kwMatches;
            console.log(`[agent] Found ${kwMatches.length} results with keyword "${keyword}"`);
            break;
          }
        }
      }

      let salesPageContent = "";
      let matchedProduct: any = null;

      for (const match of allMatches) {
        if (match.checkout_url) {
          // Check if checkout_url is already a full URL
          const checkoutUrl = match.checkout_url.startsWith("http")
            ? match.checkout_url
            : `https://pay.hotmart.com/${match.checkout_url}`;
          salesPageContent = await getCachedOrScrape(adminClient, match.type, match.id, checkoutUrl);
          if (salesPageContent) {
            matchedProduct = match;
            break;
          }
        }
      }

      if (salesPageContent && matchedProduct) {
        console.log(`[agent] Found sales page content for "${matchedProduct.name}". Making second AI call...`);

        // Second AI call with sales page context
        const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-5.2",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `HISTÓRICO COMPLETO DA CONVERSA:\n${conversationHistory}\n\nÚLTIMA MENSAGEM DO ALUNO:\n${messageContent}\n\nINFORMAÇÕES ADICIONAIS SOBRE O PRODUTO "${matchedProduct.name}" (da página de vendas):\n---\n${salesPageContent}\n---\n\nAgora com essas informações, tente responder ao aluno. Se ainda não conseguir, use shouldEscalate: true.\nResponda em JSON.`,
              },
            ],
            temperature: 0.7,
          }),
        });

        if (secondResponse.ok) {
          const secondData = await secondResponse.json();
          const secondRaw = secondData.choices?.[0]?.message?.content || "";
          try {
            const secondParsed = JSON.parse(secondRaw.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim());
            parsed = secondParsed;
            console.log(`[agent] Second AI call result: shouldEscalate=${parsed.shouldEscalate}`);
          } catch {
            console.warn("[agent] Failed to parse second AI response, keeping first response");
          }
        }
      } else {
        // No sales page found, escalate
        console.log(`[agent] No sales page found for "${parsed.productQuery}", escalating`);
        parsed.shouldEscalate = true;
        parsed.reasoning = `Não encontrei página de vendas para "${parsed.productQuery}"`;
      }
    }

    // 7. Handle escalation or send response
    if (parsed.shouldEscalate) {
      await adminClient.from("whatsapp_conversations").update({
        agent_mode: "human",
        escalation_reason: parsed.reasoning || "IA decidiu escalar",
        escalated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      const escalationMsg = parsed.message || "Vou transferir você para um dos nossos atendentes. Em breve alguém da equipe vai te responder 😊";
      const escSendResult = await sendWhatsAppMessage(normalizePhone(conversation.phone), escalationMsg, zapiCreds);
      const escMessageId = escSendResult?.messages?.[0]?.id || escSendResult?.messageId || null;
      await saveOutboundMessage(adminClient, conversationId, escalationMsg, escMessageId);

      // Timeline: escalation
      try {
        await adminClient.from("cs_timeline_events").insert({
          event_type: "whatsapp_agent",
          event_subtype: "escalated",
          user_id: conversation.profile_id || null,
          phone: conversation.phone,
          channel: "whatsapp",
          summary: `Conversa escalada: ${parsed.reasoning || "IA decidiu escalar"}`,
          metadata: { conversation_id: conversationId, reason: parsed.reasoning },
        });
      } catch (tlErr) { console.error("[agent] Timeline error:", tlErr); }

      console.log(`Agent escalated conversation ${conversationId}: ${parsed.reasoning}`);
      return new Response(JSON.stringify({ success: true, action: "escalated", reasoning: parsed.reasoning }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Note: delay already applied via debounce wait at the start

    // Send response via Z-API
    const sendResult = await sendWhatsAppMessage(normalizePhone(conversation.phone), parsed.message, zapiCreds);
    const zapiMessageId = sendResult?.messages?.[0]?.id || sendResult?.messageId || null;
    await saveOutboundMessage(adminClient, conversationId, parsed.message, zapiMessageId);

    // Timeline: responded
    try {
      await adminClient.from("cs_timeline_events").insert({
        event_type: "whatsapp_agent",
        event_subtype: "responded",
        user_id: conversation.profile_id || null,
        phone: conversation.phone,
        channel: "whatsapp",
        summary: `Agente IA respondeu conversa (${parsed.message.substring(0, 60)}...)`,
        metadata: { conversation_id: conversationId },
      });
    } catch (tlErr) { console.error("[agent] Timeline error:", tlErr); }

    console.log(`Agent replied to conversation ${conversationId}`);
    return new Response(JSON.stringify({ success: true, action: "replied", reasoning: parsed.reasoning }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-agent error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getZapiCredsForConversation(adminClient: any, conversationId: string): Promise<{ provider: string; instanceId: string | null; token: string | null; securityToken: string | null; apiUrl: string | null; instanceName: string | null }> {
  const { data: conv } = await adminClient
    .from("whatsapp_conversations")
    .select("zapi_connection_id")
    .eq("id", conversationId)
    .single();

  if (conv?.zapi_connection_id) {
    const { data: creds } = await adminClient
      .rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
    if (creds && creds.length > 0) {
      return {
        provider: creds[0].provider || 'zapi',
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
  if (!instanceId || !token || !securityToken) {
    throw new Error("WhatsApp credentials not configured");
  }
  return { provider: 'zapi', instanceId, token, securityToken, apiUrl: null, instanceName: null };
}

async function sendWhatsAppMessage(phone: string, message: string, creds: { provider: string; instanceId: string | null; token: string | null; securityToken: string | null; apiUrl: string | null; instanceName: string | null }) {
  if (creds.provider === 'era_cloud') {
    const url = `${creds.apiUrl}/v1/messages`;
    console.log("[agent] Era Cloud API URL:", url);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": creds.token! },
      body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(`Era Cloud API error: ${res.status} ${JSON.stringify(resData)}`);
    return resData;
  } else {
    const zapiUrl = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-text`;
    console.log("[agent] Z-API request URL:", zapiUrl);
    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": creds.securityToken! },
      body: JSON.stringify({ phone, message }),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(`Z-API error: ${res.status} ${JSON.stringify(resData)}`);
    return resData;
  }
}

async function resolveMediaUrl(content: string, adminClient: any, conversationId: string): Promise<string> {
  // If already a URL, return directly
  if (content.startsWith("http")) return content;

  // It's a media ID — try to resolve via Era Cloud API
  console.log(`[agent] Content is a media ID (${content}), attempting to resolve via Era Cloud API...`);

  try {
    const { data: conv } = await adminClient
      .from("whatsapp_conversations")
      .select("zapi_connection_id")
      .eq("id", conversationId)
      .single();

    if (conv?.zapi_connection_id) {
      const { data: creds } = await adminClient
        .rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });

      if (creds?.[0]?.provider === "era_cloud" && creds[0].api_url && creds[0].token) {
        const mediaEndpoint = `${creds[0].api_url}/v1/media/${content}`;
        console.log(`[agent] Fetching media URL from: ${mediaEndpoint}`);

        const res = await fetch(mediaEndpoint, {
          headers: { "X-API-Key": creds[0].token },
        });

        if (res.ok) {
          const data = await res.json();
          const url = data.url || data.link || data.download_url;
          if (url) {
            console.log(`[agent] Resolved media URL successfully: ${url.substring(0, 80)}...`);
            return url;
          }
        } else {
          console.warn(`[agent] Media resolve API returned ${res.status}`);
        }
      }
    }
  } catch (err) {
    console.error(`[agent] Error resolving media URL:`, err);
  }

  // Return original content as fallback
  return content;
}

async function analyzeMedia(apiKey: string, mediaType: string, mediaUrl: string): Promise<string> {
  const prompts: Record<string, string> = {
    image: "Descreva esta imagem em português de forma concisa (máximo 100 palavras). Foque no que é relevante para um contexto de atendimento ao cliente.",
    sticker: "Descreva este sticker/figurinha em português de forma concisa.",
    video: "Descreva este vídeo em português de forma concisa (máximo 100 palavras). Foque no que é relevante para atendimento.",
    audio: "Transcreva este áudio em português. Retorne apenas o texto transcrito, sem explicações adicionais.",
    document: "Analise este documento em português. Faça um resumo conciso (máximo 200 palavras) do conteúdo principal.",
  };
  const prompt = prompts[mediaType] || prompts.image;

  const content: any[] = [{ type: "text", text: prompt }];

  if (mediaType === "image" || mediaType === "sticker" || mediaType === "video") {
    content.push({ type: "image_url", image_url: { url: mediaUrl } });
  } else if (mediaType === "document") {
    try {
      const docResponse = await fetch(mediaUrl);
      if (!docResponse.ok) throw new Error(`Failed to download document: ${docResponse.status}`);
      const docBuffer = await docResponse.arrayBuffer();
      const docSize = docBuffer.byteLength;
      if (docSize > 10 * 1024 * 1024) {
        console.warn(`[agent] Document too large (${(docSize / 1024 / 1024).toFixed(1)}MB), skipping analysis`);
        return "[documento recebido - arquivo muito grande para análise]";
      }
      const base64Doc = btoa(String.fromCharCode(...new Uint8Array(docBuffer)));
      const mimeType = docResponse.headers.get("content-type") || "application/pdf";
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64Doc}` },
      });
    } catch (dlErr) {
      console.error("[agent] Document download failed:", dlErr);
      return "[documento recebido - não foi possível analisar o conteúdo]";
    }
  } else if (mediaType === "audio") {
    try {
      const audioResponse = await fetch(mediaUrl);
      if (!audioResponse.ok) throw new Error(`Failed to download audio: ${audioResponse.status}`);
      const audioBuffer = await audioResponse.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      const mimeType = mediaUrl.includes(".ogg") ? "audio/ogg" : "audio/mpeg";
      content.push({
        type: "input_audio",
        input_audio: { data: base64Audio, format: mimeType.includes("ogg") ? "wav" : "mp3" },
      });
    } catch (dlErr) {
      console.error("[agent] Audio download failed, trying URL directly:", dlErr);
      content.push({ type: "image_url", image_url: { url: mediaUrl } });
    }
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    console.error(`[agent] Media analysis API error: ${response.status}`);
    return "";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function saveOutboundMessage(client: any, conversationId: string, content: string, zapiMessageId?: string | null) {
  await client.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    message_type: "text",
    content,
    status: "sent",
    metadata: { source: "ai_agent" },
    ...(zapiMessageId ? { zapi_message_id: zapiMessageId } : {}),
  });

  await client.from("whatsapp_conversations").update({
    last_message_at: new Date().toISOString(),
    last_message_preview: content.substring(0, 100),
  }).eq("id", conversationId);
}
