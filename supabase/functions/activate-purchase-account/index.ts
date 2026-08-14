// Define a senha da conta criada automaticamente após uma compra (convidado).
// Segurança: exige o payment_id da compra (conhecido apenas pelo comprador),
// que o e-mail bata com o do pagamento/compra e que a conta nunca tenha sido
// acessada (last_sign_in_at nulo) — evita sequestro de contas ativas.
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

const norm = (v: unknown) => String(v || "").toLowerCase().trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payment_id, email, password } = (await req.json()) as {
      payment_id?: string;
      email?: string;
      password?: string;
    };

    const paymentId = String(payment_id || "").trim();
    const newEmail = norm(email);
    const pass = String(password || "");

    if (!paymentId) return json({ error: "Pagamento não informado" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return json({ error: "E-mail inválido" }, 400);
    if (pass.length < 6) return json({ error: "A senha deve ter pelo menos 6 caracteres" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1) Compra registrada pelo webhook
    const { data: purchase } = await supabase
      .from("purchases")
      .select("user_id, buyer_email")
      .eq("transaction_id", paymentId)
      .maybeSingle();

    let userId: string | null = purchase?.user_id ?? null;
    let purchaseEmail = norm(purchase?.buyer_email);

    // 2) Fallback: consulta o pagamento no Mercado Pago (webhook ainda não processou)
    if (!userId) {
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpToken) return json({ error: "Gateway não configurado" }, 500);
      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      if (!mpResp.ok) return json({ error: "Pagamento não encontrado", code: "not_found" }, 404);
      const payment = await mpResp.json();
      if (!["approved", "authorized"].includes(String(payment?.status))) {
        return json({ error: "Pagamento ainda não confirmado", code: "pending" }, 409);
      }
      purchaseEmail = norm(payment?.metadata?.buyer_email || payment?.payer?.email);
      if (!purchaseEmail) return json({ error: "Não autorizado" }, 403);

      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", purchaseEmail)
        .maybeSingle();
      userId = prof?.user_id ?? null;
      if (!userId) {
        return json({ error: "Conta ainda sendo criada. Tente novamente em instantes.", code: "pending" }, 409);
      }
    }

    // 3) A conta não pode ter sido usada antes (senha já definida / login feito)
    const { data: userRes, error: getErr } = await supabase.auth.admin.getUserById(userId);
    if (getErr || !userRes?.user) return json({ error: "Conta não encontrada" }, 404);
    if (userRes.user.last_sign_in_at) {
      return json({
        error: "Esta conta já está ativa. Faça login ou use 'Esqueci minha senha'.",
        code: "already_active",
      }, 409);
    }

    const currentEmail = norm(userRes.user.email);
    const emailChanged = newEmail !== currentEmail;

    if (emailChanged) {
      // Não permite migrar para um e-mail já usado por outra conta
      const { data: taken } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", newEmail)
        .maybeSingle();
      if (taken?.user_id && taken.user_id !== userId) {
        return json({ error: "Este e-mail já está em uso por outra conta." }, 409);
      }
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password: pass,
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    if (emailChanged) {
      await supabase.from("profiles").update({ email: newEmail }).eq("user_id", userId);
    }

    return json({ success: true, email: newEmail });
  } catch (err) {
    console.error("[activate-purchase-account]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
