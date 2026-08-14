// Lembretes de dados fiscais pendentes (etapa 3 do checkout).
// Roda por cron: 24h e 48h após a compra, avisa no WhatsApp quem ainda não
// preencheu o endereço necessário para a emissão da NFS-e.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_URL = "https://drinkeros.com/app/perfil";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (authFail) return authFail;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Pedidos com nota pendente por falta de endereço
    const { data: pending, error } = await supabase
      .from("nibo_sync_log")
      .select("order_id, user_id, buyer_email, product_name, created_at")
      .eq("status", "pending_fiscal")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(300);
    if (error) throw error;

    let queued = 0;
    const skipped: string[] = [];

    for (const row of pending || []) {
      const hoursSince = (Date.now() - new Date(row.created_at as string).getTime()) / 3600000;
      const stage = hoursSince >= 48 ? "48h" : hoursSince >= 24 ? "24h" : null;
      if (!stage) continue;

      const email = String(row.buyer_email || "").toLowerCase().trim();
      let query = supabase
        .from("profiles")
        .select("user_id, full_name, phone, address_neighborhood, address_street, cep, fiscal_reminder_24h_at, fiscal_reminder_48h_at");
      query = row.user_id
        ? query.eq("user_id", row.user_id)
        : query.eq("email", email);
      const { data: profile } = await query.maybeSingle();
      if (!profile) { skipped.push(`${row.order_id}: perfil não encontrado`); continue; }

      const p = profile as any;
      // Endereço já preenchido nesse meio tempo → não incomoda
      if (p.address_neighborhood && p.address_street && p.cep) continue;
      if (!p.phone) { skipped.push(`${row.order_id}: sem telefone`); continue; }
      if (stage === "24h" && p.fiscal_reminder_24h_at) continue;
      if (stage === "48h" && p.fiscal_reminder_48h_at) continue;

      const firstName = String(p.full_name || "").trim().split(" ")[0] || "tudo bem";
      const message =
        `Oi, ${firstName}! Aqui é da Drinkeros 🍸\n\n` +
        `Sua compra${row.product_name ? ` de *${row.product_name}*` : ""} está liberada!\n\n` +
        `Só falta o endereço para emitirmos a sua nota fiscal. ` +
        `Leva menos de 1 minuto: ${PROFILE_URL}`;

      const { error: qErr } = await supabase.from("whatsapp_send_queue").insert({
        phone: String(p.phone).replace(/\D/g, ""),
        message,
        context_type: "fiscal_pending",
        context_data: { order_id: row.order_id, stage },
      });
      if (qErr) { skipped.push(`${row.order_id}: ${qErr.message}`); continue; }

      await supabase
        .from("profiles")
        .update(
          stage === "24h"
            ? { fiscal_reminder_24h_at: new Date().toISOString() }
            : { fiscal_reminder_48h_at: new Date().toISOString() },
        )
        .eq("user_id", p.user_id);
      queued++;
    }

    return new Response(JSON.stringify({ success: true, queued, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-fiscal-data-reminders]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
