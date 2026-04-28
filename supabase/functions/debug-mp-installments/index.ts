// Debug temporário: consulta planos de parcelamento reais da conta MP.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;
    const publicKey = Deno.env.get("MERCADOPAGO_PUBLIC_KEY")!;
    const url = new URL(req.url);
    const amount = url.searchParams.get("amount") || "297";
    const bin = url.searchParams.get("bin") || "503143"; // Mastercard test BIN

    // 1) Conta vinculada ao access token
    const userResp = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userResp.json();

    // 2) Installments reais (mesma chamada que o Brick faz)
    const instUrl = `https://api.mercadopago.com/v1/payment_methods/installments?bin=${bin}&amount=${amount}&public_key=${publicKey}`;
    const instResp = await fetch(instUrl);
    const instData = await instResp.json();

    return new Response(JSON.stringify({
      account: {
        id: userData.id,
        nickname: userData.nickname,
        site_id: userData.site_id,
        country_id: userData.country_id,
        status: userData.status,
        tags: userData.tags,
      },
      public_key_prefix: publicKey.substring(0, 10),
      access_token_prefix: accessToken.substring(0, 10),
      amount_tested: amount,
      bin_tested: bin,
      installments_response: instData,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
