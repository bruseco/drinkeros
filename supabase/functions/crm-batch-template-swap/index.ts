import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const SHORT_LINK_BASE = "https://alunos.criminallab.com.br";

async function shortenUrl(
  supabase: ReturnType<typeof createClient>,
  url: string, source: string, productName: string | null
): Promise<string> {
  const code = crypto.randomUUID().replace(/-/g, "");
  await supabase.from("redirect_links").insert({
    code, destination_url: url, source, product_name: productName || "CRM Recovery",
  });
  return `${SHORT_LINK_BASE}/?trigger=${code}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONNECTION_ID = "c0332f67-c559-4a6a-b406-68691bdd780b";

const SWAP_MAP: Record<string, string> = {
  carrinho_abandonado_1: "carrinho_abandonado_2",
  carrinho_abandonado_2: "carrinho_abandonado_1",
  carrinho_abandonado_3: "carrinho_abandonado_4",
  carrinho_abandonado_4: "carrinho_abandonado_3",
};

const STAGE_DEFAULT: Record<string, string> = {
  carrinho_abandonado_1: "carrinho_abandonado_1",
  carrinho_abandonado_2: "carrinho_abandonado_3",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch leads in target stages with phone
    const { data: leads, error: leadsErr } = await supabase
      .from("crm_leads")
      .select("id, name, phone, stage, product_name, recovery_url")
      .in("stage", ["carrinho_abandonado_1", "carrinho_abandonado_2"])
      .not("phone", "is", null);

    if (leadsErr) throw leadsErr;
    if (!leads?.length) {
      return new Response(JSON.stringify({ queued: 0, message: "Nenhum lead encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${leads.length} leads with phone`);

    // 2. For each lead, find the last template sent via whatsapp_send_queue
    const leadIds = leads.map((l) => l.id);

    // Query all queue items for these leads to find last template per lead
    const { data: queueItems, error: queueErr } = await supabase
      .from("whatsapp_send_queue")
      .select("id, message, context_data, created_at")
      .eq("context_type", "crm_recovery")
      .order("created_at", { ascending: false });

    if (queueErr) throw queueErr;

    // Build map: lead_id -> last template name
    const lastTemplateByLead = new Map<string, string>();
    const templatePattern = /carrinho_abandonado_[1-4]/;

    for (const item of queueItems || []) {
      const leadId = (item.context_data as any)?.lead_id;
      if (!leadId || !leadIds.includes(leadId)) continue;
      if (lastTemplateByLead.has(leadId)) continue; // already found most recent

      const match = item.message?.match(templatePattern);
      if (match) {
        lastTemplateByLead.set(leadId, match[0]);
      }
    }

    console.log(`Found template history for ${lastTemplateByLead.size} leads`);

    // 3. Calculate swap and build queue + activity inserts
    const queueInserts: any[] = [];
    const activityInserts: any[] = [];
    const stats = { swapped: 0, defaulted: 0, skipped: 0 };

    for (const lead of leads) {
      const lastTemplate = lastTemplateByLead.get(lead.id);
      let nextTemplate: string;

      if (lastTemplate && SWAP_MAP[lastTemplate]) {
        nextTemplate = SWAP_MAP[lastTemplate];
        stats.swapped++;
      } else {
        nextTemplate = STAGE_DEFAULT[lead.stage];
        if (!nextTemplate) {
          stats.skipped++;
          continue;
        }
        stats.defaulted++;
      }

      // Build template message with variables (shorten recovery URL)
      let shortUrl = "";
      if (lead.recovery_url) {
        try { shortUrl = await shortenUrl(supabase, lead.recovery_url, "crm_batch_swap", lead.product_name); }
        catch { shortUrl = lead.recovery_url; }
      }
      const variables: Record<string, string> = {
        "1": lead.name || "Cliente",
        "2": lead.product_name || "produto",
        "3": shortUrl,
      };

      queueInserts.push({
        phone: lead.phone,
        message: `template:${nextTemplate}`,
        context_type: "crm_recovery",
        context_data: {
          lead_id: lead.id,
          template_name: nextTemplate,
          previous_template: lastTemplate || null,
          variables,
          connection_id: CONNECTION_ID,
        },
        priority: 8,
        status: "pending",
        zapi_connection_id: CONNECTION_ID,
      });

      activityInserts.push({
        lead_id: lead.id,
        activity_type: "whatsapp_queued",
        description: `Template ${nextTemplate} enfileirado (swap de ${lastTemplate || "nenhum"})`,
        metadata: {
          template_name: nextTemplate,
          previous_template: lastTemplate || null,
          batch: "crm-batch-template-swap",
        },
      });
    }

    console.log(`Stats: ${JSON.stringify(stats)}`);
    console.log(`Inserting ${queueInserts.length} queue items and ${activityInserts.length} activities`);

    // 4. Batch insert into whatsapp_send_queue
    if (queueInserts.length > 0) {
      const { error: insertQueueErr } = await supabase
        .from("whatsapp_send_queue")
        .insert(queueInserts);
      if (insertQueueErr) throw insertQueueErr;
    }

    // 5. Batch insert activities
    if (activityInserts.length > 0) {
      const { error: insertActErr } = await supabase
        .from("crm_lead_activities")
        .insert(activityInserts);
      if (insertActErr) throw insertActErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: queueInserts.length,
        stats,
        totalLeads: leads.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
