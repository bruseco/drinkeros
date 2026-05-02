// Cria assinatura recorrente (preapproval) do Clube no Mercado Pago.
// Retorna init_point para redirecionar o usuário ao checkout do MP.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API = "https://api.mercadopago.com";

// Planos do Clube
const PLANS = {
  monthly: { amount: 9.9, frequency: 1, frequency_type: "months", reason: "Clube dos Drinkeros · Mensal" },
  annual:  { amount: 69,  frequency: 12, frequency_type: "months", reason: "Clube dos Drinkeros · Anual" },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const body = await req.json().catch(() => ({}));
    const planKey = (body?.plan === "annual" ? "annual" : "monthly") as keyof typeof PLANS;
    const plan = PLANS[planKey];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Faça login para assinar");
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData } = await supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user?.email) throw new Error("Usuário sem email");

    const origin = req.headers.get("origin") || "https://drinkeros.com";
    const externalRef = `club:${user.id}:${planKey}:${Date.now()}`;

    const preapprovalBody = {
      reason: plan.reason,
      external_reference: externalRef,
      payer_email: user.email,
      back_url: `${origin}/clube?clube=success`,
      auto_recurring: {
        frequency: plan.frequency,
        frequency_type: plan.frequency_type,
        transaction_amount: plan.amount,
        currency_id: "BRL",
      },
      status: "pending",
    };

    const resp = await fetch(`${MP_API}/preapproval`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalBody),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("[create-mp-subscription] MP error:", data);
      throw new Error(data?.message || "Falha ao criar assinatura");
    }

    console.log("[create-mp-subscription] created:", { id: data.id, status: data.status });

    return new Response(
      JSON.stringify({ url: data.init_point, id: data.id, status: data.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[create-mp-subscription]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
