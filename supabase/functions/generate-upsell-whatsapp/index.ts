import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_DAYS = 7;

interface ConversationMessage {
  direction: string;
  content: string;
  created_at: string;
}

interface GenerateWhatsAppRequest {
  productName: string;
  productDescription: string;
  productType: "package" | "course";
  productId: string;
  studentName: string;
  completedModuleName: string;
  checkoutUrl: string;
  sequenceStep: number; // 1-4
  conversationHistory: ConversationMessage[];
  triggerType?: "progress" | "time"; // padrão: "progress"
}

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
      return cached.scraped_content;
    }
  }

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY || !checkoutUrl) return "";

  try {
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

const STEP_STRATEGIES_PROGRESS: Record<number, string> = {
  1: `ESTRATÉGIA DO DIA 1 - CONEXÃO:
- Fale sobre o progresso do aluno no módulo que ele completou
- Pergunte o que ele está achando do conteúdo, como está sendo a experiência
- Crie rapport genuíno, demonstre interesse real
- Mencione a oferta de forma MUITO sutil apenas no final, como quem comenta casualmente
- O objetivo principal é CONECTAR, não vender`,

  2: `ESTRATÉGIA DO DIA 2 - VALOR:
- Aprofunde nos benefícios específicos do produto ofertado
- Use argumentos reais da página de vendas
- Se o lead respondeu anteriormente com dúvidas, RESPONDA antes de avançar
- Mostre como o produto complementa o que ele já está estudando
- Inclua o link de checkout de forma natural`,

  3: `ESTRATÉGIA DO DIA 3 - PROVA SOCIAL / URGÊNCIA LEVE:
- Reforce a transformação que o produto proporciona
- Use dados concretos, resultados ou depoimentos (pode inventar cenários realistas)
- Mantenha tom consultivo, como um mentor
- Se o lead demonstrou interesse, reforce os pontos que chamaram atenção dele
- Urgência leve: "estamos com condição especial" ou similar`,

  4: `ESTRATÉGIA DO DIA 4 - ESCASSEZ / ÚLTIMO CONTATO:
- Este é o ÚLTIMO contato da sequência
- Urgência real: condição especial encerrando
- CTA direto com link de checkout
- Respeite se o lead já disse que não tem interesse
- Agradeça pela atenção independente da decisão
- Tom de despedida amigável`,
};

const STEP_STRATEGIES_TIME: Record<number, string> = {
  1: `ESTRATÉGIA DO DIA 1 - OFERTA DIRETA:
- Apresente a oferta como uma oportunidade nova de aprofundamento no mundo dos drinks
- NÃO mencione progresso, módulos completados ou histórico de estudos
- Seja direto na oferta, mas com tom consultivo e humano
- Destaque os principais benefícios do produto ofertado
- Inclua o link de checkout de forma natural`,

  2: `ESTRATÉGIA DO DIA 2 - VALOR:
- Aprofunde nos benefícios específicos do produto ofertado
- Use argumentos reais da página de vendas
- Se o lead respondeu anteriormente com dúvidas, RESPONDA antes de avançar
- Reforce como este produto pode expandir o conhecimento no mundo dos drinks
- NÃO mencione progresso ou conclusão de conteúdo anterior
- Inclua o link de checkout de forma natural`,

  3: `ESTRATÉGIA DO DIA 3 - PROVA SOCIAL / URGÊNCIA LEVE:
- Reforce a transformação que o produto proporciona
- Use dados concretos, resultados ou depoimentos (pode inventar cenários realistas)
- Mantenha tom consultivo, como um mentor apresentando uma oportunidade
- NÃO mencione estudos anteriores ou módulos concluídos
- Urgência leve: "estamos com condição especial" ou similar`,

  4: `ESTRATÉGIA DO DIA 4 - ESCASSEZ / ÚLTIMO CONTATO:
- Este é o ÚLTIMO contato da sequência
- Urgência real: condição especial encerrando
- CTA direto com link de checkout
- NÃO mencione progresso ou conteúdo anterior
- Respeite se o lead já disse que não tem interesse
- Agradeça pela atenção independente da decisão
- Tom de despedida amigável`,
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      productName,
      productDescription,
      productType,
      productId,
      studentName,
      completedModuleName,
      checkoutUrl,
      sequenceStep,
      conversationHistory,
      triggerType = "progress",
    }: GenerateWhatsAppRequest = await req.json();

    const step = Math.max(1, Math.min(4, sequenceStep || 1));
    const strategyMap = triggerType === "time" ? STEP_STRATEGIES_TIME : STEP_STRATEGIES_PROGRESS;
    const strategy = strategyMap[step];
    const productLabel = productType === "course" ? "curso" : "módulo";

    // Get scraped sales page content
    const salesPageContent = productId
      ? await getCachedOrScrape(supabase, productType, productId, checkoutUrl)
      : "";

    // Build conversation history context
    let historyContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      historyContext = "\n\nHISTÓRICO COMPLETO DA CONVERSA (analise TUDO antes de gerar a mensagem):\n";
      for (const msg of conversationHistory) {
        const date = new Date(msg.created_at);
        const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const direction = msg.direction === "outbound" ? "ENVIADO" : "RECEBIDO";
        historyContext += `[${direction} ${dateStr}] ${msg.content}\n`;
      }
      historyContext += "\nANÁLISE OBRIGATÓRIA DO HISTÓRICO:\n";
      historyContext += "- Se o lead RESPONDEU positivamente: reforce o interesse dele, mencione o que ele disse\n";
      historyContext += "- Se o lead fez PERGUNTAS: responda as perguntas ANTES de seguir a cadência\n";
      historyContext += "- Se o lead pediu para PARAR ou demonstrou DESINTERESSE (ex: 'não quero', 'para de mandar', 'não tenho interesse', 'cancela', 'sai', 'remove'): retorne optOut: true\n";
      historyContext += "- Se NÃO houve resposta: siga a cadência normalmente\n";
    }

    const salesPageContext = salesPageContent
      ? `\n\nCONTEÚDO DA PÁGINA DE VENDAS (use como fonte de benefícios e argumentos):\n---\n${salesPageContent}\n---`
      : "";

    const systemPrompt = `Você é uma pessoa REAL da equipe Drinkeros que conversa com alunos pelo WhatsApp.
REGRAS ABSOLUTAS:
1. Escreva como uma PESSOA REAL, não como um bot ou mensagem automatizada
2. Use linguagem informal mas profissional, como um colega/mentor escreveria no WhatsApp
3. NUNCA use saudações formais como "Prezado" ou "Estimado"
4. Use emojis de forma MODERADA (1-3 por mensagem), como uma pessoa real usaria
5. Máximo 250 palavras
6. Texto PURO (sem HTML, sem markdown, sem formatação especial)
7. Quebre em parágrafos curtos (2-3 frases cada), adequados para leitura no celular
8. Inclua o link de checkout (${checkoutUrl}) de forma NATURAL no texto quando apropriado
9. SEMPRE analise o histórico completo da conversa antes de gerar qualquer resposta
10. Se detectar QUALQUER sinal de desinteresse ou pedido de opt-out, responda com optOut: true
11. Assine como um membro da equipe (ex: "Abraço, Equipe Drinkeros" ou similar)
12. PRIMEIRA PESSOA DO PLURAL (nós, nosso, nossa)
13. Português brasileiro

DETECÇÃO DE OPT-OUT - Retorne optOut: true se encontrar sinais como:
- "não quero", "para de mandar", "não tenho interesse", "cancela", "sai fora"
- "não me mande mais", "remove meu número", "para com isso"
- Qualquer variação clara de desinteresse ou pedido para parar`;

    const contextLine = triggerType === "time"
      ? `- Produto adquirido pelo aluno (referência): "${completedModuleName}" — NÃO mencione progresso ou módulos concluídos`
      : `- Módulo que completou (60%+): "${completedModuleName}"`;

    const userPrompt = `Gere uma mensagem de WhatsApp para o aluno.

CONTEXTO:
- Nome do aluno: ${studentName}
- ${contextLine}
- Produto a ofertar: ${productLabel} "${productName}"
- Descrição: ${productDescription || "Conteúdo exclusivo para aprofundamento no mundo dos drinks"}
- Link de checkout: ${checkoutUrl}
- Mensagem ${step} de 4 da sequência
${salesPageContext}
${historyContext}

${strategy}

FORMATO DE RESPOSTA (JSON puro, sem blocos de código):
{
  "message": "texto da mensagem aqui",
  "optOut": false,
  "reasoning": "breve explicação da decisão"
}

Se detectar opt-out, retorne:
{
  "message": "",
  "optOut": true,
  "reasoning": "motivo do opt-out detectado"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Parse JSON response
    let parsed: { message: string; optOut: boolean; reasoning: string };
    try {
      // Remove potential markdown code blocks
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: treat entire content as message
      parsed = { message: content, optOut: false, reasoning: "Fallback: could not parse JSON" };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: parsed.message,
        optOut: parsed.optOut || false,
        reasoning: parsed.reasoning || "",
        step,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error generating upsell WhatsApp:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
