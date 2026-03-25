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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getBestSizeUrl(sizes: Array<{ width: number; link: string }>): string {
  // Prefer 1280px wide, fallback to largest available
  const sorted = [...sizes].sort((a, b) => b.width - a.width);
  const hd = sorted.find((s) => s.width === 1280);
  return hd ? hd.link : sorted[0]?.link || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin auth
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
      return new Response(
        JSON.stringify({ error: "Invalid Vimeo URL" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    // Step 1: Get video info (duration + name)
    const videoRes = await fetch(
      `https://api.vimeo.com/videos/${videoId}?fields=duration,name,link`,
      { headers: vimeoHeaders }
    );

    if (!videoRes.ok) {
      const errorText = await videoRes.text();
      console.error("Vimeo video fetch error:", videoRes.status, errorText);
      const status = videoRes.status === 404 ? 404 : 502;
      const message = videoRes.status === 404
        ? "Video not found. Check if the URL is correct and if your Vimeo token has access to this video."
        : "Failed to fetch video info from Vimeo";
      return new Response(
        JSON.stringify({ error: message }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const videoData = await videoRes.json();
    const duration = videoData.duration; // in seconds

    if (!duration || duration < 1) {
      return new Response(
        JSON.stringify({ error: "Video has no duration" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Calculate 5 timestamps
    const percentages = [0.1, 0.25, 0.5, 0.75, 0.9];
    const timestamps = percentages.map((p) => Math.floor(duration * p));

    // Step 3: Create thumbnails at each timestamp
    const thumbnails: Array<{ time: number; url: string; label: string }> = [];
    let creationFailed = false;

    for (const time of timestamps) {
      try {
        const createRes = await fetch(
          `https://api.vimeo.com/videos/${videoId}/pictures`,
          {
            method: "POST",
            headers: vimeoHeaders,
            body: JSON.stringify({ time, active: false }),
          }
        );

        if (!createRes.ok) {
          console.error(
            `Failed to create thumbnail at ${time}s:`,
            createRes.status,
            await createRes.text()
          );
          creationFailed = true;
          break;
        }

        const pictureData = await createRes.json();
        const url = getBestSizeUrl(pictureData.sizes || []);
        if (url) {
          thumbnails.push({
            time,
            url,
            label: formatTime(time),
          });
        }
      } catch (err) {
        console.error(`Error creating thumbnail at ${time}s:`, err);
        creationFailed = true;
        break;
      }
    }

    // Step 4: Fallback - if creation failed, list existing thumbnails
    if (creationFailed && thumbnails.length === 0) {
      console.log("Falling back to existing thumbnails...");
      try {
        const listRes = await fetch(
          `https://api.vimeo.com/videos/${videoId}/pictures?per_page=5`,
          { headers: vimeoHeaders }
        );

        if (listRes.ok) {
          const listData = await listRes.json();
          for (const pic of listData.data || []) {
            const url = getBestSizeUrl(pic.sizes || []);
            if (url) {
              thumbnails.push({
                time: 0,
                url,
                label: "Existente",
              });
            }
          }
        }
      } catch (err) {
        console.error("Fallback listing error:", err);
      }
    }

    if (thumbnails.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Could not generate or find any thumbnails",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract resolved URL with privacy hash from Vimeo link field
    const resolvedUrl = videoData.link || null;

    return new Response(JSON.stringify({ thumbnails, duration, resolvedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
