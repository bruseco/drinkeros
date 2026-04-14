import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500 });
    }

    // Fetch 3 lessons with notes_status = 'pending' (transcript already available)
    const { data: lessons, error: fetchError } = await supabase
      .from("recipes")
      .select("id, name, transcript")
      .eq("notes_status", "pending")
      .not("transcript", "is", null)
      .limit(3);

    if (fetchError) {
      console.error("Error fetching lessons:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      console.log("No lessons pending note generation");
      return new Response(JSON.stringify({ processed: 0, message: "No lessons pending" }));
    }

    console.log(`Generating notes for ${lessons.length} lessons`);
    const results: any[] = [];

    for (const lesson of lessons) {
      try {
        if (!lesson.transcript || lesson.transcript.trim().length < 100) {
          await supabase
            .from("recipes")
            .update({ notes_status: "error" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "error", reason: "Transcript too short" });
          continue;
        }

        const systemPrompt = `Você é um assistente de anotações do Drinkeros.

Com base EXCLUSIVAMENTE na transcrição da aula fornecida, elabore uma anotação completa como se fosse o caderno de um bartender profissional ou estudante de coquetelaria.

**NÃO mencione concursos, provas, bancas, gabaritos, aprovação ou qualquer referência a exames.** Foque no conteúdo técnico com profundidade.

Estruture a anotação da seguinte forma:

## Tema da Aula
[Tema principal abordado na aula]

## Conceitos Fundamentais
[Definições e explicações dos conceitos abordados, com profundidade técnica. Explique cada conceito de forma completa como apareceu na aula.]

## Técnicas e Métodos
[Técnicas de preparo, equipamentos, métodos — exatamente como mencionados na aula, com o contexto de aplicação]

## Ingredientes e Insumos
[Ingredientes mencionados, suas características, substituições possíveis e dicas de uso. Omita esta seção se não houver ingredientes mencionados.]

## Análise e Discussões da Aula
[Pontos debatidos pelo professor, variações de receitas, dicas práticas, exemplos utilizados]

## Síntese das Ideias Centrais
[Resumo das principais conclusões da aula — máximo 6 tópicos]

---
Tom: técnico e prático, como caderno de anotações de curso profissionalizante. Sem emojis. Fidelidade total à transcrição — não invente técnicas, receitas ou informações não mencionadas. Não repita a mesma informação em seções diferentes.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-preview",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Aula: "${lesson.name}"\n\nTranscrição:\n${lesson.transcript}`,
              },
            ],
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error(`AI error for lesson ${lesson.id}:`, aiRes.status, errText);
          await supabase
            .from("recipes")
            .update({ notes_status: "error" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "error", reason: `AI error: ${aiRes.status}` });
          continue;
        }

        const aiData = await aiRes.json();
        const notes = aiData.choices?.[0]?.message?.content;

        if (!notes || notes.trim().length === 0) {
          await supabase
            .from("recipes")
            .update({ notes_status: "error" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "error", reason: "Empty AI response" });
          continue;
        }

        // Save notes to instructions field and mark as done
        await supabase
          .from("recipes")
          .update({
            instructions: notes.trim(),
            notes_status: "done",
          })
          .eq("id", lesson.id);

        results.push({ id: lesson.id, status: "done", notesLength: notes.trim().length });
      } catch (lessonErr) {
        console.error(`Error generating notes for lesson ${lesson.id}:`, lessonErr);
        await supabase
          .from("recipes")
          .update({ notes_status: "error" })
          .eq("id", lesson.id);
        results.push({ id: lesson.id, status: "error", reason: String(lessonErr) });
      }
    }

    console.log("Note generation complete:", results);
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
