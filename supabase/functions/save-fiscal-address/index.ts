// Salva o endereço fiscal DEPOIS do pagamento (etapa 3 do checkout).
// Usuário logado: usa o JWT. Convidado: valida o pagamento no Mercado Pago
// e confere se o e-mail informado bate com o do pagamento.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface AddressInput {
  cep?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string | null;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, payment_id, address } = (await req.json()) as {
      email?: string;
      payment_id?: string;
      address?: AddressInput;
    };

    const cep = String(address?.cep || "").replace(/\D/g, "");
    const street = String(address?.address_street || "").trim();
    const number = String(address?.address_number || "").trim();
    const neighborhood = String(address?.address_neighborhood || "").trim();
    const city = String(address?.address_city || "").trim();
    const state = String(address?.address_state || "").trim().toUpperCase().slice(0, 2);
    const complement = address?.address_complement ? String(address.address_complement).trim() : null;

    const missing: string[] = [];
    if (cep.length !== 8) missing.push("CEP");
    if (!street) missing.push("rua");
    if (!number) missing.push("número");
    if (!neighborhood) missing.push("bairro");
    if (!city) missing.push("cidade");
    if (state.length !== 2) missing.push("UF");
    if (missing.length) {
      return json({ error: `Endereço incompleto (faltando: ${missing.join(", ")})` }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const update = {
      cep,
      address_street: street,
      address_number: number,
      address_complement: complement,
      address_neighborhood: neighborhood,
      address_city: city,
      address_state: state,
    };

    // 1) Usuário logado
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
      if (data.user) {
        const { error } = await supabase.from("profiles").update(update).eq("user_id", data.user.id);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }
    }

    // 2) Convidado — precisa do payment_id validado no Mercado Pago
    if (!payment_id || !email) return json({ error: "Não autorizado" }, 401);

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) return json({ error: "Gateway não configurado" }, 500);

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    if (!mpResp.ok) return json({ error: "Pagamento não encontrado" }, 404);
    const payment = await mpResp.json();

    const paymentEmail = String(
      payment?.payer?.email || payment?.metadata?.buyer_email || "",
    ).toLowerCase().trim();
    const normalizedEmail = String(email).toLowerCase().trim();
    if (!paymentEmail || paymentEmail !== normalizedEmail) {
      return json({ error: "Não autorizado" }, 403);
    }
    if (!["approved", "authorized", "in_process", "pending"].includes(String(payment?.status))) {
      return json({ error: "Pagamento não confirmado" }, 400);
    }

    const { error } = await supabase.from("profiles").update(update).eq("email", normalizedEmail);
    if (error) return json({ error: error.message }, 400);

    return json({ success: true });
  } catch (err) {
    console.error("[save-fiscal-address]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
