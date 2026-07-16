// Shared internal-auth guard for cron/agent/internal edge functions.
// Accepts:
//   - Header `x-internal-secret` equal to SUPABASE_SERVICE_ROLE_KEY (used by
//     cron jobs and internal edge-to-edge invocations), OR
//     equal to INTERNAL_FUNCTION_SECRET when that secret is set.
//   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//   - Authorization: Bearer <user JWT> where the user is an admin
//     (checked via the `can_edit` RPC).
//
// Returns a Response on rejection or null when the request should proceed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function assertInternalOrAdmin(
  req: Request,
  corsHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const cronSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";

  const internalHeader = req.headers.get("x-internal-secret") ?? "";
  if (
    internalHeader &&
    ((serviceKey && internalHeader === serviceKey) ||
      (cronSecret && internalHeader === cronSecret))
  ) {
    return null;
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (token && serviceKey && token === serviceKey) {
    return null;
  }

  if (token && supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: userData } = await admin.auth.getUser(token);
      const uid = userData?.user?.id;
      if (uid) {
        const { data: canEdit } = await admin.rpc("can_edit", { _user_id: uid });
        if (canEdit === true) return null;
      }
    } catch (_e) {
      // fallthrough to reject
    }
  }

  return new Response(
    JSON.stringify({ error: "unauthorized" }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
