import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
  return match ? match[1] : null;
}

function parseSrtVtt(content: string): string {
  let text = content.replace(/^\uFEFF/, "");
  text = text.replace(/^WEBVTT[\s\S]*?\n\n/, "");
  text = text.replace(/^\d+\s*$/gm, "");
  text = text.replace(/[\d:.,-]+\s*-->\s*[\d:.,-]+.*$/gm, "");
  text = text.replace(/<[^>]+>/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }
  return deduped.join(" ");
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const vimeoToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
    if (!vimeoToken) {
      console.error("VIMEO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "VIMEO_ACCESS_TOKEN not configured" }), { status: 500 });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Fetch 5 lessons with transcript_status IS NULL that have Vimeo URLs and are published
    const { data: lessons, error: fetchError } = await supabase
      .from("recipes")
      .select("id, name, video_url")
      .is("transcript_status", null)
      .eq("status", "published")
      .ilike("video_url", "%vimeo%")
      .limit(5);

    if (fetchError) {
      console.error("Error fetching lessons:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!lessons || lessons.length === 0) {
      console.log("No lessons to process");
      return new Response(JSON.stringify({ processed: 0, message: "No lessons to process" }));
    }

    console.log(`Processing ${lessons.length} lessons`);
    const results: any[] = [];

    for (const lesson of lessons) {
      try {
        const videoId = extractVimeoId(lesson.video_url || "");
        if (!videoId) {
          await supabase
            .from("recipes")
            .update({ transcript_status: "error" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "error", reason: "Invalid Vimeo URL" });
          continue;
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
          await supabase
            .from("recipes")
            .update({ transcript_status: "error" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "error", reason: `Vimeo API error: ${ttRes.status}` });
          continue;
        }

        const ttData = await ttRes.json();
        const tracks = ttData.data || [];

        if (tracks.length === 0) {
          await supabase
            .from("recipes")
            .update({ transcript_status: "no_transcript" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "no_transcript" });
          continue;
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
        if (!bestTrack.link) {
          await supabase
            .from("recipes")
            .update({ transcript_status: "no_transcript" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "no_transcript", reason: "Track found but no download link" });
          continue;
        }

        // Download the SRT/VTT file
        const fileRes = await fetch(bestTrack.link);
        if (!fileRes.ok) {
          await supabase
            .from("recipes")
            .update({ transcript_status: "error" })
            .eq("id", lesson.id);
          results.push({ id: lesson.id, status: "error", reason: "Failed to download transcript file" });
          continue;
        }

        const fileContent = await fileRes.text();
        const rawTranscript = parseSrtVtt(fileContent);

        let transcript = rawTranscript;

        // Apply AI correction if transcript is long enough
        if (rawTranscript.length >= 50 && lovableApiKey) {
          try {
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
                    content: `Você é um especialista em transcrição de áudio jurídico em português brasileiro. O texto abaixo é uma transcrição automática defeituosa gerada por um sistema que interpretou áudio em português como se fosse inglês. Reconstrua o texto original em português brasileiro correto, interpretando foneticamente as palavras. O conteúdo é uma aula de Direito Criminal/Penal. Retorne APENAS o texto corrigido, sem explicações.`,
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
              }
            } else {
              console.error(`AI correction failed for ${lesson.id}:`, aiRes.status);
            }
          } catch (aiErr) {
            console.error(`AI correction error for ${lesson.id}:`, aiErr);
          }
        }

        // Save transcript and mark as done, set notes_status to pending
        await supabase
          .from("recipes")
          .update({
            transcript,
            transcript_status: "done",
            notes_status: "pending",
          })
          .eq("id", lesson.id);

        results.push({ id: lesson.id, status: "done", transcriptLength: transcript.length });
      } catch (lessonErr) {
        console.error(`Error processing lesson ${lesson.id}:`, lessonErr);
        await supabase
          .from("recipes")
          .update({ transcript_status: "error" })
          .eq("id", lesson.id);
        results.push({ id: lesson.id, status: "error", reason: String(lessonErr) });
      }
    }

    console.log("Processing complete:", results);
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
