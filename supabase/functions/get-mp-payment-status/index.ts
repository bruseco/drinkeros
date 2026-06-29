// Consulta o status de um pagamento Mercado Pago (usado no polling do Pix).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function invokeWebhookFallback(paymentId: string) {
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-mp-sync": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      },
      body: JSON.stringify({ type: "payment", data: { id: paymentId }, source: "get-mp-payment-status-fallback" }),
    });
    if (!resp.ok) console.warn("[get-mp-payment-status] webhook fallback non-2xx", resp.status);
  } catch (e) {
    console.warn("[get-mp-payment-status] webhook fallback failed", (e as Error).message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new Error("Missing payment id");

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.message || "Falha ao consultar pagamento");

    // Rede de segurança para PIX: quando o polling detecta aprovação, força o mesmo fluxo idempotente do webhook.
    if (data?.status === "approved") {
      await invokeWebhookFallback(id);
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        status_detail: data.status_detail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
