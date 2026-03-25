import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const connectionId = url.searchParams.get("connection_id");

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: "connection_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate connection_id exists in database before processing
    const { data: connCheck, error: connCheckError } = await supabase
      .from("zapi_connections")
      .select("id")
      .eq("id", connectionId)
      .maybeSingle();

    if (connCheckError || !connCheck) {
      console.error(`[status-webhook] Invalid connection_id: ${connectionId}`);
      return new Response(
        JSON.stringify({ error: "Invalid connection_id" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const eventType = body.type || body.event;

    console.log(`[status-webhook] Received event: ${eventType} for connection ${connectionId}`);

    // supabase client already created above for connection validation

    let newStatus: string;
    let disconnectReason: string | null = null;

    // Z-API events
    if (eventType === "ConnectedCallback" || body.connected === true) {
      newStatus = "connected";
    } else if (eventType === "DisconnectedCallback" || body.disconnected === true) {
      newStatus = "disconnected";
      disconnectReason = body.error || body.reason || "Desconectado";
    } else {
      console.log(`[status-webhook] Unknown event type: ${eventType}, body:`, JSON.stringify(body));
      return new Response(
        JSON.stringify({ ok: true, event: "ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, any> = {
      connection_status: newStatus,
      last_status_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "disconnected") {
      updateData.is_active = false;
      updateData.last_disconnect_reason = disconnectReason;
    } else if (newStatus === "connected") {
      updateData.is_active = true;
      updateData.last_disconnect_reason = null;
    }

    const { error } = await supabase
      .from("zapi_connections")
      .update(updateData)
      .eq("id", connectionId);

    if (error) {
      console.error(`[status-webhook] DB error:`, error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[status-webhook] Connection ${connectionId} updated to ${newStatus}`);

    return new Response(
      JSON.stringify({ ok: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[status-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
