import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// SECURITY: This bootstrap function is permanently disabled.
// The initial super_admin has already been provisioned. Promote new admins
// via the authenticated admin UI / user_roles table — never via an unauth endpoint.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error:
        "bootstrap-admin is permanently disabled. Promote admins through the authenticated admin panel.",
    }),
    {
      status: 410, // Gone
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
};

serve(handler);
