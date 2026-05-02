import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    // Busca vip_payment mais recente com preapproval do MP
    const { data: payments } = await supabase
      .from("vip_payments")
      .select("id, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const preapprovalId = payments?.find(
      (p: any) => p.metadata?.mp_preapproval_id
    )?.metadata?.mp_preapproval_id as string | undefined;

    if (!preapprovalId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_subscription",
          message:
            "Nenhuma assinatura recorrente encontrada. Se foi pago manualmente ou por outro canal, fale com o suporte pelo WhatsApp.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const resp = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[cancel-vip-subscription] MP error:", data);
      throw new Error(data?.message || "Falha ao cancelar assinatura");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Assinatura cancelada. Você mantém acesso até o fim do período já pago.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cancel-vip-subscription]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
