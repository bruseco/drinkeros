import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL = 300; // 5 minutes

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  // Public URL form: .../storage/v1/object/public/<bucket>/<path>
  // Signed URL form: .../storage/v1/object/sign/<bucket>/<path>?token=...
  const m = fileUrl.match(
    new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/([^?]+)`)
  );
  if (m) return decodeURIComponent(m[1]);
  // Fallback: assume already a path
  if (!fileUrl.startsWith("http")) return fileUrl;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind;
    const id = body?.id;

    if (!kind || !id || typeof id !== "string") {
      return jsonResponse({ error: "kind and id are required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let bucket: string;
    let fileUrl: string | null = null;

    if (kind === "ebook") {
      const { data: allowed, error: e1 } = await admin.rpc("has_ebook_access", {
        _user_id: userId,
        _ebook_id: id,
      });
      if (e1) throw e1;
      if (!allowed) return jsonResponse({ error: "forbidden" }, 403);

      const { data: ebook, error: e2 } = await admin
        .from("ebooks")
        .select("file_url")
        .eq("id", id)
        .maybeSingle();
      if (e2) throw e2;
      if (!ebook?.file_url) return jsonResponse({ error: "file not found" }, 404);

      bucket = "ebook-files";
      fileUrl = ebook.file_url;
    } else if (kind === "recipe-material") {
      // id = recipe_material id
      const { data: mat, error: e1 } = await admin
        .from("recipe_materials")
        .select("recipe_id, file_url")
        .eq("id", id)
        .maybeSingle();
      if (e1) throw e1;
      if (!mat?.file_url) return jsonResponse({ error: "material not found" }, 404);

      const { data: allowed, error: e2 } = await admin.rpc("has_recipe_access", {
        _user_id: userId,
        _recipe_id: mat.recipe_id,
      });
      if (e2) throw e2;
      if (!allowed) return jsonResponse({ error: "forbidden" }, 403);

      bucket = "lesson-materials";
      fileUrl = mat.file_url;
    } else {
      return jsonResponse({ error: "invalid kind" }, 400);
    }

    const path = extractStoragePath(fileUrl, bucket);
    if (!path) return jsonResponse({ error: "invalid file path" }, 500);

    const { data: signed, error: signErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL, { download: true });

    if (signErr || !signed?.signedUrl) {
      console.error("[get-signed-file-url] sign error:", signErr);
      return jsonResponse({ error: "could not sign url" }, 500);
    }

    return jsonResponse({ url: signed.signedUrl, expires_in: SIGNED_URL_TTL });
  } catch (err) {
    console.error("[get-signed-file-url] error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
