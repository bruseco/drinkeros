// Captura nome + e-mail antes de liberar o desconto do presente nas páginas de venda.
// Público (sem JWT). Grava o lead e devolve apenas o status — nenhum dado sensível.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OFFERS, generateToken, isValidEmail, normalizeEmail } from "../_shared/offerLeads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const pageKey = String(body?.page_key || "").trim();
    const offer = OFFERS[pageKey];
    if (!offer) return json({ error: "Oferta inválida" }, 400);

    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email)) return json({ error: "E-mail inválido" }, 400);

    const name = String(body?.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (name.length < 2) return json({ error: "Informe seu nome" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Usuário logado (opcional) — ajuda na checagem de compra depois.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data } = await anon.auth.getUser(authHeader.slice(7));
        userId = data.user?.id ?? null;
      } catch { /* visitante */ }
    }

    // Se já existe lead recente para o mesmo e-mail/página, não duplica.
    const { data: existing } = await supabase
      .from("landing_offer_leads")
      .select("id, created_at")
      .eq("page_key", pageKey)
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("landing_offer_leads")
        .update({ name, user_id: userId ?? undefined })
        .eq("id", (existing as any).id);
      return json({ ok: true, deduped: true });
    }

    const { error } = await supabase.from("landing_offer_leads").insert({
      page_key: pageKey,
      name,
      email,
      user_id: userId,
      discount_token: generateToken(),
    });
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    console.error("[capture-offer-lead]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
