import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const expectedSecret = Deno.env.get("CRM_WEBHOOK_SECRET");
    if (expectedSecret) {
      const provided = req.headers.get("x-webhook-secret") || new URL(req.url).searchParams.get("secret");
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: Record<string, string>;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
    }
    const {
      name,
      email,
      phone,
      product_name,
      sale_value,
      source = "webhook",
    } = body;

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Campo 'name' é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Deduplication: check if lead already exists in pico_vendas funnel by email or phone
    if (email || phone) {
      const conditions: string[] = [];
      if (email) conditions.push(`email.eq.${email}`);
      if (phone) conditions.push(`phone.eq.${phone}`);

      const { data: existing } = await supabase
        .from("crm_leads")
        .select("id")
        .eq("funnel", "pico_vendas")
        .not("stage", "in", "(convertido,perdido)")
        .or(conditions.join(","))
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Lead já existe no funil",
            lead_id: existing[0].id,
            deduplicated: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Try to find existing profile by email
    let profileId: string | null = null;
    if (email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (profile) profileId = profile.id;
    }

    const { data: lead, error } = await supabase
      .from("crm_leads")
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        product_name: product_name || null,
        sale_value: sale_value ? Number(sale_value) : null,
        source,
        stage: "entrada_contato",
        funnel: "pico_vendas",
        profile_id: profileId,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from("crm_lead_activities").insert({
      lead_id: lead.id,
      activity_type: "stage_change",
      description: "Lead criado via webhook no funil Pico de Vendas",
    });

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Erro no webhook pico-vendas:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
