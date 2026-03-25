import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 9 email templates forming a single upsell sequence
// The AI will adapt each one to the specific product, using first person plural (nós/nosso)
const SEQUENCE_TEMPLATES = [
  {
    step: 1,
    titleTemplate: `[ NOVO ] {{product_name}}…`,
    bodyTemplate: `Olá, {{student_name}},

Acabamos de liberar uma Oferta Especial no nosso Treinamento para {{main_benefit}}.

Veja todos os detalhes aqui!

Neste treinamento você vai aprender como {{benefit_1}};

Vai ser capaz de {{benefit_2}} e mais, muito mais!

Não tem segredo... ou você {{action_needed}} ou dificilmente vai conseguir {{transformation}}.

Veja tudo aqui!

Mas faça isso agora, você sabe como as coisas funcionam…

Quem chega primeiro tem MUITO MAIS vantagens :)

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 2,
    titleTemplate: `[ Oferta Liberada ] Desconto Especial no {{product_name}}`,
    bodyTemplate: `Olá, {{student_name}},

Acabamos de liberar as inscrições para o {{product_name}} e você pode fazer sua inscrição agora com um desconto especial.

Acesse aqui e veja todos os detalhes!

Neste treinamento você vai aprender {{benefit_1}}, {{benefit_2}}, {{benefit_3}} e mais, muito mais!

Em resumo…

Finalmente você vai conseguir {{transformation}}.

Acesse aqui Para Garantir Sua Vaga Com Desconto Especial!

Esperamos que você consiga aproveitar esta oportunidade a tempo…

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 3,
    titleTemplate: `Torne-se {{main_benefit}}`,
    bodyTemplate: `Olá, {{student_name}},

Como não temos certeza se você viu, decidimos reforçar o aviso…

Acabamos de liberar uma oferta bem especial com desconto no nosso Novo Treinamento!

Acesse aqui e veja todos os detalhes!

Se você quer aprender como {{benefit_1}}, {{benefit_2}}, {{benefit_3}} e muito mais, o seu lugar é aqui conosco: no {{product_name}}!

Aqui está um resumo do que você leva ao garantir a sua vaga:

{{deliverables}}

e mais, muito mais…

Veja todos os detalhes aqui e garanta já a sua vaga!

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 4,
    titleTemplate: `[ Ainda dá tempo ] Desconto Especial no {{product_name}}…`,
    bodyTemplate: `Olá, {{student_name}},

Passando para lembrar que AINDA DÁ TEMPO de garantir a sua vaga no {{product_name}} com um Desconto Exclusivo!

Veja todos os detalhes aqui!

Se inscrevendo no {{product_name}} agora, você investe menos e ainda leva bônus bem exclusivos!

Neste treinamento você vai aprender como {{benefit_1}};

Como {{benefit_2}};

Vai ser capaz de {{benefit_3}}.

Em outras palavras…

Você vai {{transformation}}.

Acesse aqui e garanta sua vaga!

Esperamos que você consiga aproveitar esta oportunidade a tempo!

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 5,
    titleTemplate: `Encerrando…`,
    bodyTemplate: `Olá, {{student_name}},

Se você quiser {{main_benefit}}, acesse aqui e garanta a sua vaga no {{product_name}}.

Neste treinamento vamos te ajudar a {{benefit_1}}, {{benefit_2}}, {{benefit_3}} e muito mais!

Você vai aprender a {{benefit_1}};

{{benefit_2}};

{{benefit_3}};

Em resumo…

Você vai chegar no fim desse treinamento muito mais {{main_benefit}}!

Ao fazer a sua inscrição agora você leva:

{{deliverables}}

E muito mais!

Acesse aqui, veja a descrição completa e garanta já a sua vaga!

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 6,
    titleTemplate: `Você só tem até amanhã...`,
    bodyTemplate: `Este treinamento vai ajudar você a {{main_benefit}}.

Olá, {{student_name}},

Precisávamos avisar você…

Recentemente liberamos uma Oferta Bem Especial no nosso Novo treinamento {{product_name}}… e falta pouco para esta oportunidade acabar!

Acesse aqui e veja todos os detalhes!

É duro ver as pessoas ficando de fora, adiando seus sonhos, seus planos…

Se você quer aprender como {{benefit_1}}, {{benefit_2}}, {{benefit_3}} e muito mais, o melhor que você pode fazer agora é se inscrever no {{product_name}}!

Veja todos os detalhes aqui!

Neste exato momento ele está com Desconto Especial e uma lista de bônus bem especial!

Este treinamento tem uma meta muito bem clara e definida: ajudar você a {{transformation}}!

Em breve a condição especial vai se encerrar e quem ficar para trás vai adiar mais uma vez a oportunidade de se tornar muito mais {{main_benefit}}.

Esperamos sinceramente que você não deixe essa oportunidade passar :)

Vamos ficar muito felizes de ver seu nome na lista de inscritos!

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 7,
    titleTemplate: `Último dia!`,
    bodyTemplate: `Olá, {{student_name}},

Estamos passando só para lembrar que ACABA HOJE a oportunidade de garantir sua vaga no nosso Novo Treinamento {{product_name}}, com esta oferta especial.

Ao fazer parte dessa turma você leva:

{{deliverables}}

E muito mais!

Acesse aqui, veja a descrição completa e garanta já a sua vaga!

Faltam apenas algumas horas para encerrar, esperamos sinceramente que você consiga aproveitar esta oportunidade...

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 8,
    titleTemplate: `[ Acaba Hoje ] {{product_name}}`,
    bodyTemplate: `Olá, {{student_name}},

O tempo está acabando para ter acesso à Oferta Especial do {{product_name}}.

Relembrando…

Neste treinamento você vai aprender como {{benefit_1}};

Como {{benefit_2}};

Vai ser capaz de {{benefit_3}}.

Acesse aqui e veja todos os detalhes!

Aliás, nesta Oferta Especial você leva de bônus:

{{deliverables}}

Tudo com uma meta muito bem clara e definida:

{{transformation}}!

E estes são apenas os bônus…

Você precisa ver o treinamento :)

Acesse aqui e garanta a sua cópia!

Depois das 23:59 de hoje já não garantimos mais que você vai ter acesso a esta oferta especial…

Esperamos que você consiga aproveitar esta oportunidade a tempo!

Um abraço,
Equipe Criminal Lab`,
  },
  {
    step: 9,
    titleTemplate: `Chamada Final – Seu desconto está expirando…`,
    bodyTemplate: `Olá, {{student_name}},

Esse é o nosso último aviso sobre a oferta especial que liberamos recentemente no nosso novo treinamento…

Acesse aqui e veja se você ainda consegue uma vaga com o DESCONTO ESPECIAL!

Essa é a sua chance de {{main_benefit}}.

Neste treinamento vamos te ajudar a {{benefit_1}}, {{benefit_2}}, {{benefit_3}} e muito mais!

Você vai aprender a {{benefit_1}};

Vai conhecer {{benefit_2}};

Vamos te ensinar como {{benefit_3}};

Em resumo…

Você vai chegar no fim desse treinamento muito mais {{main_benefit}}!

Ao fazer a sua inscrição agora você leva:

{{deliverables}}

E muito mais!

Mas você precisa agir rápido, porque depois das 23:59 de hoje já não garantimos mais que você vai ter acesso a esta oferta…

Acesse aqui, veja a descrição completa e garanta já a sua vaga!

Esperamos que você consiga aproveitar esta oportunidade a tempo :)

Um abraço,
Equipe Criminal Lab`,
  },
];

interface GenerateRequest {
  productName: string;
  productDescription: string;
  productType: "package" | "course";
  productId: string;
  studentName: string;
  completedModuleName: string;
  checkoutUrl: string;
  sequenceStep: number; // 1-9
  triggerType?: "progress" | "time"; // padrão: "progress"
}

const CACHE_TTL_DAYS = 7;

async function getCachedOrScrape(
  supabase: any,
  productType: string,
  productId: string,
  checkoutUrl: string
): Promise<string> {
  // 1. Check cache
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
      console.log(`Using cached scrape for ${productType}:${productId} (${age.toFixed(1)} days old)`);
      return cached.scraped_content;
    }
  }

  // 2. Scrape via Firecrawl
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY || !checkoutUrl) return "";

  try {
    console.log("Scraping sales page:", checkoutUrl);
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
      console.log("Sales page scraped successfully, content length:", content.length);

      // 3. Save to cache (upsert)
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
    } else {
      console.warn("Failed to scrape sales page:", scrapeResponse.status);
      return cached?.scraped_content || "";
    }
  } catch (err) {
    console.warn("Error scraping sales page (continuing without it):", err);
    return cached?.scraped_content || "";
  }
}

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
      triggerType = "progress",
    }: GenerateRequest = await req.json();

    const step = Math.max(1, Math.min(9, sequenceStep || 1));
    const template = SEQUENCE_TEMPLATES[step - 1];
    const productLabel = productType === "course" ? "curso" : "módulo";

    // Get scraped content from cache or fresh scrape
    const salesPageContent = productId
      ? await getCachedOrScrape(supabase, productType, productId, checkoutUrl)
      : "";

    const salesPageContext = salesPageContent
      ? `\n\nCONTEÚDO REAL DA PÁGINA DE VENDAS DO PRODUTO (use para extrair benefícios, tom, linguagem e argumentos reais):\n---\n${salesPageContent}\n---\nIMPORTANTE: Use os benefícios, argumentos e o tom encontrados na página de vendas acima para criar uma copy muito mais precisa e alinhada com o produto real.`
      : "";

    // Build unsubscribe URL
    const unsubscribeUrl = `${supabaseUrl}/functions/v1/upsell-unsubscribe?token=${encodeURIComponent(btoa(JSON.stringify({ userId: productId ? studentName : "" })))}`;

    const systemPrompt = `Você é um copywriter especialista em educação online e direito penal/criminal.
Seu objetivo é adaptar templates de email de upsell para a plataforma educacional "Criminal Lab".
REGRAS OBRIGATÓRIAS:
1. SEMPRE use a primeira pessoa do PLURAL (nós, nosso, nossa, liberamos, temos, etc.) - NUNCA use "eu", "meu", "minha".
2. O tom deve ser profissional, motivador e com senso de urgência, sem ser agressivo.
3. Escreva em português brasileiro.
4. NÃO use emojis excessivos. Máximo 1-2 por email.
5. Mantenha a estrutura e o estilo do template original, apenas adaptando ao produto específico.
6. O email deve ter entre 150-400 palavras no corpo.
7. Assine sempre como "Equipe Criminal Lab".
8. Todos os links devem apontar para: ${checkoutUrl}
9. Se houver conteúdo da página de vendas disponível, USE-O como fonte principal de benefícios, argumentos e linguagem.
10. NÃO inclua o link de descadastramento no corpo - ele será adicionado automaticamente no rodapé do template.`;

    const contextLine = triggerType === "time"
      ? `- Contexto: o aluno adquiriu "${completedModuleName}" há alguns dias. Apresente esta oferta como uma oportunidade de ampliar o conhecimento em Direito Criminal. NÃO mencione progresso, módulos completados ou estudos anteriores — apenas ofereça o produto diretamente com tom consultivo.`
      : `- Contexto: o aluno completou mais de 60% do módulo "${completedModuleName}". Celebre o progresso e apresente o próximo passo natural como evolução dos estudos.`;

    const userPrompt = `Adapte o template de email abaixo para o produto específico.

INFORMAÇÕES DO CONTEXTO:
- Nome do aluno: ${studentName}
- ${contextLine}
- Produto a ofertar: ${productLabel} "${productName}"
- Descrição do produto: ${productDescription || "Conteúdo exclusivo para aprofundamento profissional em direito penal"}
- Link de checkout: ${checkoutUrl}
- Este é o email ${step} de 9 da sequência de upsell
${salesPageContext}

TEMPLATE BASE (email ${step}/9):
Título sugerido: ${template.titleTemplate}

Corpo:
${template.bodyTemplate}

INSTRUÇÕES:
1. Substitua todos os placeholders ({{...}}) por conteúdo real baseado na descrição do produto e NO CONTEÚDO DA PÁGINA DE VENDAS (se disponível).
2. Adapte os benefícios e a transformação para serem específicos ao produto "${productName}".
3. Mantenha a estrutura e o tom do template original.
4. Todos os "Acesse aqui", "Veja todos os detalhes" etc devem ser links para ${checkoutUrl}.
5. Use SEMPRE primeira pessoa do plural (nós, nosso, nossa).

Retorne EXATAMENTE neste formato (sem markdown, sem blocos de código):
SUBJECT: [linha de assunto adaptada ao produto]
BODY: [corpo do email em HTML simples, com links, parágrafos e formatação inline]

O corpo HTML deve:
- Usar tags <p> para parágrafos
- Links com estilo: color:#dc2626; font-weight:bold; text-decoration:underline;
- Um botão CTA principal com estilo inline: background-color:#dc2626; color:white; padding:14px 28px; border-radius:8px; text-decoration:none; display:inline-block; font-weight:bold; font-size:16px;
- O botão deve linkar para ${checkoutUrl}`;

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI usage" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const subjectMatch = content.match(/SUBJECT:\s*(.+?)(?:\n|BODY:)/s);
    const bodyMatch = content.match(/BODY:\s*([\s\S]+)$/);

    const subject = subjectMatch?.[1]?.trim() || template.titleTemplate.replace("{{product_name}}", productName);
    let body = bodyMatch?.[1]?.trim() || content;

    // Append unsubscribe footer
    body += `<br/><hr style="margin-top:30px;border:none;border-top:1px solid #e5e7eb;"/>
<p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:10px;">
Se você não deseja receber estas ofertas, <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">clique aqui para se descadastrar</a>.
</p>`;

    return new Response(
      JSON.stringify({ success: true, subject, body, step }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error generating upsell email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
