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

function hasHash(url: string): boolean {
  return /vimeo\.com\/\d+\/[a-zA-Z0-9]+/.test(url);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAuth.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vimeoToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
    if (!vimeoToken) {
      return new Response(JSON.stringify({ error: "VIMEO_ACCESS_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read/update all recipes
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all recipes with vimeo URLs
    const { data: recipes, error: fetchError } = await supabase
      .from("recipes")
      .select("id, video_url")
      .like("video_url", "%vimeo.com%");

    if (fetchError) {
      throw new Error(`Failed to fetch recipes: ${fetchError.message}`);
    }

    // Filter to only those without hash
    const needsHash = (recipes || []).filter(
      (r) => r.video_url && !hasHash(r.video_url) && extractVimeoId(r.video_url)
    );

    console.log(`Found ${needsHash.length} recipes needing hash resolution`);

    const vimeoHeaders = {
      Authorization: `Bearer ${vimeoToken}`,
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    };

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipe of needsHash) {
      const videoId = extractVimeoId(recipe.video_url!);
      if (!videoId) continue;

      try {
        const res = await fetch(
          `https://api.vimeo.com/videos/${videoId}?fields=link`,
          { headers: vimeoHeaders }
        );

        if (!res.ok) {
          const txt = await res.text();
          console.error(`Vimeo API error for ${videoId}: ${res.status} ${txt}`);
          errors.push(`${videoId}: ${res.status}`);
          failed++;
          continue;
        }

        const data = await res.json();
        const resolvedUrl = data.link;

        if (resolvedUrl && hasHash(resolvedUrl)) {
          const { error: updateError } = await supabase
            .from("recipes")
            .update({ video_url: resolvedUrl })
            .eq("id", recipe.id);

          if (updateError) {
            console.error(`Update error for ${recipe.id}: ${updateError.message}`);
            errors.push(`update ${recipe.id}: ${updateError.message}`);
            failed++;
          } else {
            updated++;
          }
        } else {
          // Video link doesn't have hash (public video), skip
          console.log(`Video ${videoId} has no hash in link: ${resolvedUrl}`);
        }

        // Rate limit: avoid hammering Vimeo API
        if (needsHash.indexOf(recipe) % 10 === 9) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error(`Error processing ${videoId}:`, err);
        errors.push(`${videoId}: ${err.message}`);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        total: needsHash.length,
        updated,
        failed,
        errors: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
