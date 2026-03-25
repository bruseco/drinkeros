import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, total_carousels, recent_interactions } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!recent_interactions || recent_interactions.length < 5) {
      // Not enough data — return random position
      const position = Math.max(1, Math.floor(Math.random() * Math.max(total_carousels || 2, 2)));
      return new Response(
        JSON.stringify({ position, reasoning: "Not enough interaction data, using random placement." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a UX optimization agent. Your job is to decide the best position (index) to place an upsell section within a list of content carousels on a learning platform home page.

Rules:
- Position 0 is NEVER allowed (reserved for the main catalog)
- Maximum position is ${total_carousels || 3}
- Analyze the user's interaction history to find patterns
- Positions where the user clicked the upsell are positive signals
- Positions where the user saw the upsell but didn't click are negative signals  
- If the user's average scroll depth is low, prefer earlier positions
- Return ONLY a JSON object with "position" (integer) and "reasoning" (short string)

Example output: {"position": 2, "reasoning": "User clicks early and rarely scrolls past position 3"}`;

    const userPrompt = `User interaction history:
${JSON.stringify(recent_interactions, null, 2)}

Total carousels currently: ${total_carousels}

Decide the best position for the upsell section.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_upsell_position",
              description: "Set the optimal position for the upsell section",
              parameters: {
                type: "object",
                properties: {
                  position: { type: "integer", description: "The carousel index (1-based, never 0)" },
                  reasoning: { type: "string", description: "Brief explanation of why this position was chosen" },
                },
                required: ["position", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_upsell_position" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429 || response.status === 402) {
        // Fallback to random on rate limit / payment issues
        const position = Math.max(1, Math.floor(Math.random() * Math.max(total_carousels || 2, 2)));
        return new Response(
          JSON.stringify({ position, reasoning: "AI rate limited, using random placement." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway returned ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      // Ensure position is valid
      const position = Math.max(1, Math.min(result.position || 1, total_carousels || 3));
      return new Response(
        JSON.stringify({ position, reasoning: result.reasoning || "AI decided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback if tool call parsing fails
    const position = Math.max(1, Math.floor(Math.random() * Math.max(total_carousels || 2, 2)));
    return new Response(
      JSON.stringify({ position, reasoning: "Fallback to random placement." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ux-placement-agent error:", error);
    // Always return a valid position even on error
    const position = 1;
    return new Response(
      JSON.stringify({ position, reasoning: "Error occurred, defaulting to position 1." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
