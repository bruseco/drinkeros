// Lembrete: a janela de 80% OFF do Sócio do Clube termina amanhã.
// A janela de 7 dias começa no PRIMEIRO ACESSO AO APP (user_plans.discount_intro_started_at,
// gravado pelo RPC start_vip_discount_window). Este cron roda 1x por dia e avisa
// quem está no 6º dia da janela. Dedup por email_send_log (1 envio por janela).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://drinkeros.com/app/cursos";
const WINDOW_DAYS = 7;
const TEMPLATE = "clube-discount-ending";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(d);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (authFail) return authFail;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = Date.now();
    // 6º dia da janela: começou entre 6 e 7 dias atrás
    const from = new Date(now - WINDOW_DAYS * 86400000).toISOString();
    const to = new Date(now - (WINDOW_DAYS - 1) * 86400000).toISOString();

    const { data: plans, error } = await supabase
      .from("user_plans")
      .select("user_id, discount_intro_started_at, expires_at")
      .eq("plan", "vip")
      .gte("discount_intro_started_at", from)
      .lt("discount_intro_started_at", to)
      .limit(500);
    if (error) throw error;

    let sent = 0;
    const skipped: string[] = [];

    for (const row of plans || []) {
      const userId = row.user_id as string;
      // Assinatura já expirada não recebe
      if (row.expires_at && new Date(row.expires_at as string).getTime() < now) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      const email = String((profile as any)?.email || "").toLowerCase().trim();
      if (!email) { skipped.push(`${userId}: sem e-mail`); continue; }

      // Dedup: já enviamos esse lembrete nos últimos 30 dias?
      const { data: already } = await supabase
        .from("email_send_log")
        .select("id")
        .eq("template_name", TEMPLATE)
        .eq("recipient_email", email)
        .gte("created_at", new Date(now - 30 * 86400000).toISOString())
        .limit(1);
      if (already && already.length > 0) continue;

      const endsAt = new Date(
        new Date(row.discount_intro_started_at as string).getTime() + WINDOW_DAYS * 86400000,
      );

      const sendRes = await sendTemplateEmailWithLog(supabase, {
        templateName: TEMPLATE,
        recipientEmail: email,
        idempotencyKey: `${TEMPLATE}:${userId}:${row.discount_intro_started_at}`,
        templateData: {
          userName: String((profile as any)?.full_name || "").trim().split(" ")[0] || undefined,
          appUrl: APP_URL,
          endsAt: fmtDate(endsAt),
        },
      });
      if (!sendRes.success) { skipped.push(`${userId}: ${sendRes.error}`); continue; }
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-clube-discount-ending]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
