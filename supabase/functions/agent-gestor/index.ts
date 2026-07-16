import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Agent Gestor (Manager) — Coordinates proactive actions across all agents.
 * Called BEFORE proactive sends (welcome, onboarding, study_reminder, upsell, crm_recovery).
 * Uses Gemini 3 Flash to decide if action should proceed based on recent interactions.
 *
 * Input:  { phone, actionType, actionContext? }
 * Output: { allowed: boolean, reason: string, suggestedDelay?: number }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { phone, actionType, actionContext } = await req.json();
    if (!phone || !actionType) throw new Error("phone and actionType are required");

    const cleanPhone = phone.replace(/\D/g, "");

    // 1. Find active conversation for this phone
    const { data: conversation } = await adminClient
      .from("whatsapp_conversations")
      .select("id, agent_mode, agent_type, status, last_message_at, escalated_at")
      .or(`phone.like.%${cleanPhone}%,phone.like.%${cleanPhone.slice(-10)}%`)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Check recent timeline events for this phone (last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEvents } = await adminClient
      .from("cs_timeline_events")
      .select("event_type, event_subtype, channel, summary, created_at")
      .or(`phone.like.%${cleanPhone}%,phone.like.%${cleanPhone.slice(-10)}%`)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Check recent WhatsApp sends in queue for this phone (last 6h)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentQueueItems } = await adminClient
      .from("whatsapp_send_queue")
      .select("context_type, status, created_at")
      .or(`phone.like.%${cleanPhone}%,phone.like.%${cleanPhone.slice(-10)}%`)
      .gte("created_at", sixHoursAgo)
      .in("status", ["pending", "processing", "sent"]);

    // 4. Quick rule-based checks (before LLM)
    // Rule 1: If conversation is in human mode, DON'T send proactive messages
    if (conversation?.agent_mode === "human") {
      return respond({ allowed: false, reason: "Conversa em modo humano — atendente ativo, não interferir" });
    }

    // Rule 2: If escalated in last 2h, DON'T send proactive
    if (conversation?.escalated_at) {
      const escalatedAge = Date.now() - new Date(conversation.escalated_at).getTime();
      if (escalatedAge < 2 * 60 * 60 * 1000) {
        return respond({ allowed: false, reason: "Conversa escalada recentemente, aguardar resolução" });
      }
    }

    // Rule 3: If agent already active on this conversation, check conflict
    const conflictMap: Record<string, string[]> = {
      welcome: ["welcome", "onboarding"],
      onboarding: ["welcome", "onboarding"],
      study_reminder: ["upsell", "welcome"],
      upsell: ["study_reminder", "recuperacao", "welcome"],
      crm_recovery: ["upsell", "welcome"],
    };

    const conflicts = conflictMap[actionType] || [];
    const recentConflict = (recentEvents || []).find((e: any) =>
      conflicts.some(c => e.event_type.includes(c) || e.summary?.toLowerCase().includes(c))
    );

    if (recentConflict) {
      return respond({
        allowed: false,
        reason: `Conflito com ação recente: "${recentConflict.summary}" (${new Date(recentConflict.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })})`,
        suggestedDelay: 6 * 60 * 60 * 1000, // 6h
      });
    }

    // Rule 4: If there's a pending/processing queue item of same type, skip
    const sameTypeQueue = (recentQueueItems || []).find((q: any) => q.context_type === actionType);
    if (sameTypeQueue) {
      return respond({ allowed: false, reason: `Já existe item "${actionType}" na fila (${sameTypeQueue.status})` });
    }

    // Rule 5: Max 2 proactive sends per 24h per phone
    const proactiveEvents = (recentEvents || []).filter((e: any) =>
      ["welcome", "onboarding", "study_reminder", "upsell", "crm_recovery"].some(t =>
        e.event_type.includes(t) && e.event_subtype === "sent"
      )
    );
    if (proactiveEvents.length >= 2) {
      return respond({
        allowed: false,
        reason: `Limite de 2 ações proativas/24h atingido (${proactiveEvents.length} envios recentes)`,
      });
    }

    // 5. For complex cases, use LLM to decide
    if (recentEvents && recentEvents.length > 3) {
      const eventsContext = (recentEvents || []).map((e: any) => {
        const time = new Date(e.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        return `[${time}] ${e.event_type}/${e.event_subtype}: ${e.summary}`;
      }).join("\n");

      const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é o Gestor de Comunicações da Drinkeros. Sua função é decidir se uma ação proativa deve ser enviada a um aluno/lead, considerando o histórico recente de interações.

OBJETIVO: Evitar que o aluno receba mensagens conflitantes ou excessivas.

AÇÃO PROPOSTA: ${actionType}
${actionContext ? `CONTEXTO: ${actionContext}` : ""}

EVENTOS RECENTES (últimas 24h):
${eventsContext}

CONVERSA ATUAL: ${conversation ? `modo=${conversation.agent_mode}, agente=${conversation.agent_type || "nenhum"}, última msg=${conversation.last_message_at}` : "sem conversa ativa"}

REGRAS:
1. Não enviar upsell se CS acabou de fazer onboarding (< 6h)
2. Não enviar recuperação se aluno está em atendimento IA ou humano
3. Não enviar study_reminder se aluno recebeu welcome < 48h
4. Máximo 2 ações proativas por 24h
5. Na dúvida, permita (melhor comunicar do que perder oportunidade)`,
            },
            { role: "user", content: "Devo permitir esta ação proativa? Responda em JSON." },
          ],
          tools: [{
            type: "function",
            function: {
              name: "decide_action",
              description: "Decide se a ação proativa deve ser permitida",
              parameters: {
                type: "object",
                properties: {
                  allowed: { type: "boolean" },
                  reason: { type: "string", description: "Justificativa" },
                  suggestedDelay: { type: "number", description: "Delay sugerido em ms (0 se imediato)" },
                },
                required: ["allowed", "reason"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "decide_action" } },
          temperature: 0.1,
        }),
      });

      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          try {
            const decision = JSON.parse(toolCall.function.arguments);
            console.log(`[gestor] LLM decision for ${actionType}@${cleanPhone}: allowed=${decision.allowed}, reason=${decision.reason}`);

            // Log decision in timeline
            try {
              await adminClient.from("cs_timeline_events").insert({
                event_type: "agent_gestor",
                event_subtype: decision.allowed ? "approved" : "blocked",
                phone,
                channel: "system",
                summary: `Gestor ${decision.allowed ? "aprovou" : "bloqueou"} "${actionType}": ${decision.reason}`,
                metadata: { action_type: actionType, decision },
              });
            } catch {}

            return respond(decision);
          } catch {}
        }
      }
    }

    // 6. Default: allow
    console.log(`[gestor] Allowing ${actionType} for ${cleanPhone} (no conflicts)`);
    return respond({ allowed: true, reason: "Nenhum conflito detectado" });
  } catch (error) {
    console.error("agent-gestor error:", error);
    // On error, allow the action (fail-open to not block operations)
    return new Response(
      JSON.stringify({ allowed: true, reason: `Erro no gestor: ${error instanceof Error ? error.message : "unknown"}, permitindo por segurança` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function respond(data: { allowed: boolean; reason: string; suggestedDelay?: number }) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
