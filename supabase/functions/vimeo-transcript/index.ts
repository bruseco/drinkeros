import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  return match ? match[1] : null;
}

function parseSrtVtt(content: string): string {
  // Remove BOM
  let text = content.replace(/^\uFEFF/, "");
  // Remove WEBVTT header
  text = text.replace(/^WEBVTT[\s\S]*?\n\n/, "");
  // Remove cue numbers (standalone lines with just digits)
  text = text.replace(/^\d+\s*$/gm, "");
  // Remove timestamps (00:00:00,000 --> 00:00:00,000 or 00:00.000 --> 00:00.000)
  text = text.replace(/[\d:.,-]+\s*-->\s*[\d:.,-]+.*$/gm, "");
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Clean up whitespace
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  // Deduplicate consecutive identical lines
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }
  return deduped.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin auth (same pattern as vimeo-thumbnails)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin", {
      _user_id: user.id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { videoUrl } = await req.json();
    const videoId = extractVimeoId(videoUrl);
    if (!videoId) {
      return new Response(JSON.stringify({ error: "Invalid Vimeo URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vimeoToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
    if (!vimeoToken) {
      return new Response(
        JSON.stringify({ error: "VIMEO_ACCESS_TOKEN not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const vimeoHeaders = {
      Authorization: `Bearer ${vimeoToken}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    };

    // Fetch text tracks
    const ttRes = await fetch(
      `https://api.vimeo.com/videos/${videoId}/texttracks`,
      { headers: vimeoHeaders }
    );

    if (!ttRes.ok) {
      const status = ttRes.status === 404 ? 404 : 502;
      return new Response(
        JSON.stringify({ error: "Failed to fetch text tracks from Vimeo" }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const ttData = await ttRes.json();
    const tracks = ttData.data || [];

    if (tracks.length === 0) {
      return new Response(
        JSON.stringify({
          transcript: null,
          message: "Nenhuma transcrição ou legenda encontrada neste vídeo.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prioritize: pt captions > pt subtitles > any captions > any subtitles > first track
    const sorted = [...tracks].sort((a: any, b: any) => {
      const langScore = (t: any) => {
        const lang = (t.language || "").toLowerCase();
        if (lang === "pt" || lang === "pt-br") return 0;
        if (lang.startsWith("pt")) return 1;
        return 2;
      };
      const typeScore = (t: any) => {
        const type = (t.type || "").toLowerCase();
        if (type === "captions") return 0;
        if (type === "subtitles") return 1;
        return 2;
      };
      const diff = langScore(a) - langScore(b);
      return diff !== 0 ? diff : typeScore(a) - typeScore(b);
    });

    const bestTrack = sorted[0];
    const downloadLink = bestTrack.link;

    if (!downloadLink) {
      return new Response(
        JSON.stringify({
          transcript: null,
          message: "Track encontrada mas sem link de download.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Download the SRT/VTT file
    const fileRes = await fetch(downloadLink);
    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download transcript file" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fileContent = await fileRes.text();
    const rawTranscript = parseSrtVtt(fileContent);

    let transcript = rawTranscript;
    let aiCorrected = false;

    if (rawTranscript.length >= 50) {
      try {
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        if (lovableApiKey) {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Você é um especialista em transcrição de áudio em português brasileiro. O texto abaixo é uma transcrição automática defeituosa gerada por um sistema que interpretou áudio em português como se fosse inglês. Reconstrua o texto original em português brasileiro correto, interpretando foneticamente as palavras. O conteúdo é uma aula sobre drinks e coquetéis. Retorne APENAS o texto corrigido, sem explicações.`,
                },
                { role: "user", content: rawTranscript },
              ],
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const corrected = aiData.choices?.[0]?.message?.content;
            if (corrected && corrected.trim().length > 0) {
              transcript = corrected.trim();
              aiCorrected = true;
            }
          } else {
            console.error("AI correction failed:", aiRes.status, await aiRes.text());
          }
        }
      } catch (aiErr) {
        console.error("AI correction error:", aiErr);
      }
    }

    return new Response(
      JSON.stringify({
        transcript,
        ai_corrected: aiCorrected,
        language: bestTrack.language || "unknown",
        type: bestTrack.type || "unknown",
        trackName: bestTrack.name || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
