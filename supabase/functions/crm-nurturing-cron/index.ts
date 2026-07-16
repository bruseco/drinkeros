import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const SHORT_LINK_BASE = "https://alunos.criminallab.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

const RECOVERY_STAGES = [
  "carrinho_abandonado_1",
  "carrinho_abandonado_2",
  "pix_nao_pago_1",
  "pix_nao_pago_2",
  "cartao_recusado",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get automation settings
    const { data: settings, error: settingsErr } = await supabase
      .from("crm_automation_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsErr || !settings) {
      console.log("No automation settings found or error:", settingsErr?.message);
      return new Response(JSON.stringify({ ok: true, processed: 0, reason: "no_settings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nurturingDays = settings.nurturing_days || 7;
    const nurturingStage = settings.nurturing_stage || "oferta_alternativa";

    // ========== PHASE 1: AUTOMATIC STAGE ESCALATION (always runs) ==========
    const escalationResults = { escalated: 0, convertedDuringEscalation: 0 };

    // Helper: check if email has active enrollment
    async function hasEnrollment(email: string): Promise<boolean> {
      const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
      if (!profile) return false;
      const [{ count: p }, { count: c }, { count: co }] = await Promise.all([
        supabase.from("user_packages").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
        supabase.from("user_courses").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
        supabase.from("user_combos").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id),
      ]);
      return ((p || 0) + (c || 0) + (co || 0)) > 0;
    }

    // Helper: enqueue recovery WhatsApp for escalated lead
    async function enqueueEscalationWhatsApp(
      lead: any, bindingProcess: string
    ): Promise<void> {
      if (!lead.phone) return;
      const { data: bindingRows } = await supabase
        .from("whatsapp_template_bindings")
        .select("template_name, connection_id, variable_map")
        .eq("process", bindingProcess).eq("is_active", true);

      let binding: any = null;
      if (bindingRows && bindingRows.length > 0) {
        binding = bindingRows[Math.floor(Math.random() * bindingRows.length)];
      } else {
        // fallback to general
        const { data: fallback } = await supabase
          .from("whatsapp_template_bindings")
          .select("template_name, connection_id, variable_map")
          .eq("process", "crm_recovery_geral").eq("is_active", true);
        if (fallback && fallback.length > 0) binding = fallback[Math.floor(Math.random() * fallback.length)];
      }
      if (!binding) { console.log(`No binding for ${bindingProcess}, skip WhatsApp`); return; }

      const varMap = (binding.variable_map || {}) as Record<string, string>;
      const templateVars: Record<string, string> = {};
      for (const [idx, sysVar] of Object.entries(varMap)) {
        switch (sysVar) {
          case "lead_name": templateVars[idx] = (lead.name || "Cliente").split(" ")[0]; break;
          case "product_name": templateVars[idx] = lead.product_name || "nosso curso"; break;
          case "recovery_url": {
            if (lead.recovery_url) {
              templateVars[idx] = await shortenUrl(supabase, lead.recovery_url, "crm_nurturing", lead.product_name);
            }
            break;
          }
        }
      }
      for (const [k, v] of Object.entries(templateVars)) { if (!v || !v.trim()) delete templateVars[k]; }

      const message = `[Template: ${binding.template_name}]`;
      await supabase.from("whatsapp_send_queue").insert({
        phone: lead.phone, message,
        context_type: "crm_recovery",
        context_data: {
          lead_id: lead.id, stage: lead.stage, product_name: lead.product_name,
          template_name: binding.template_name, template_variables: templateVars,
        },
        priority: 8,
        zapi_connection_id: binding.connection_id,
      });

      await supabase.from("crm_lead_activities").insert({
        lead_id: lead.id, activity_type: "whatsapp_sent",
        description: `Mensagem de recuperação (estágio 2) enviada via WhatsApp (template: ${binding.template_name})`,
        metadata: { template: binding.template_name, process: bindingProcess },
      });
    }

    // Escalation rules: [fromStage, hoursThreshold, toStage, bindingProcess (null = no message)]
    const escalationRules: [string, number, string, string | null][] = [
      ["carrinho_abandonado_1", 24, "carrinho_abandonado_2", "crm_recovery_carrinho_2"],
      ["pix_nao_pago_1", 24, "pix_nao_pago_2", "crm_recovery_pix_2"],
      ["carrinho_abandonado_2", 48, nurturingStage, null],
      ["pix_nao_pago_2", 48, nurturingStage, null],
    ];

    for (const [fromStage, hours, toStage, bindProcess] of escalationRules) {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data: leads } = await supabase
        .from("crm_leads")
        .select("id, name, email, phone, product_name, recovery_url, stage")
        .eq("stage", fromStage)
        .is("converted_at", null)
        .is("lost_reason", null)
        .lt("updated_at", cutoff)
        .limit(500);

      if (!leads || leads.length === 0) continue;
      console.log(`Escalation: ${leads.length} leads in ${fromStage} > ${hours}h`);

      for (const lead of leads) {
        try {
          // Check enrollment
          if (lead.email && await hasEnrollment(lead.email)) {
            console.log(`Lead ${lead.id} already enrolled, converting`);
            await supabase.from("crm_leads").update({ stage: "convertido", converted_at: new Date().toISOString() }).eq("id", lead.id);
            await supabase.from("crm_lead_activities").insert({
              lead_id: lead.id, activity_type: "stage_change",
              description: "Convertido automaticamente: email já possui matrícula ativa",
              metadata: { source: "crm-nurturing-cron", phase: "escalation" },
            });
            escalationResults.convertedDuringEscalation++;
            continue;
          }

          // Move stage
          await supabase.from("crm_leads").update({ stage: toStage }).eq("id", lead.id);
          await supabase.from("crm_lead_activities").insert({
            lead_id: lead.id, activity_type: "stage_change",
            description: `Escalonado automaticamente: ${fromStage} → ${toStage} (${hours}h sem conversão)`,
            metadata: { source: "crm-nurturing-cron", from: fromStage, to: toStage },
          });

          // Send WhatsApp for stage 2 escalations
          if (bindProcess) {
            await enqueueEscalationWhatsApp(lead, bindProcess);
          }

          escalationResults.escalated++;
        } catch (e) {
          console.error(`Escalation error for lead ${lead.id}:`, e);
        }
      }
    }

    console.log(`Phase 1 done: ${escalationResults.escalated} escalated, ${escalationResults.convertedDuringEscalation} converted`);

    // ========== PHASE 2: NURTURING (only if enabled) ==========
    if (!settings.nurturing_enabled) {
      console.log("Nurturing is disabled, skipping Phase 2");
      return new Response(JSON.stringify({
        ok: true, escalation: escalationResults, processed: 0, reason: "nurturing_disabled"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== PHASE 2: EXISTING NURTURING LOGIC ==========

    // 2. Find leads in recovery stages older than X days, not yet converted/lost/nurtured
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - nurturingDays);

    const { data: eligibleLeads, error: leadsErr } = await supabase
      .from("crm_leads")
      .select("id, name, email, phone, product_id, product_type, product_name, stage")
      .in("stage", RECOVERY_STAGES)
      .is("converted_at", null)
      .is("lost_reason", null)
      .lt("created_at", cutoffDate.toISOString())
      .limit(100);

    if (leadsErr) {
      console.error("Error fetching leads:", leadsErr.message);
      throw leadsErr;
    }

    if (!eligibleLeads || eligibleLeads.length === 0) {
      console.log("No eligible leads for nurturing phase");
      return new Response(JSON.stringify({
        ok: true, processed: 0, escalation: escalationResults, reason: "no_nurturing_leads"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${eligibleLeads.length} eligible leads for nurturing`);

    // 3. Fetch all active upsell product rules
    const { data: upsellRules } = await supabase
      .from("upsell_product_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    // 4. Fetch template binding for crm_nurturing_oferta process
    const { data: bindings } = await supabase
      .from("whatsapp_template_bindings")
      .select("*, zapi_connections:connection_id(id, provider, api_url, token, waba_id)")
      .eq("process", "crm_nurturing_oferta")
      .eq("is_active", true);

    // 5. Fetch product names for offer products (packages, courses, combos)
    const offerProductIds = (upsellRules || []).map((r: any) => r.offer_product_id);
    const uniqueOfferIds = [...new Set(offerProductIds)];

    let productNameMap: Record<string, { name: string; checkout_url?: string }> = {};

    if (uniqueOfferIds.length > 0) {
      // Try packages
      const { data: pkgs } = await supabase
        .from("packages")
        .select("id, name")
        .in("id", uniqueOfferIds);
      (pkgs || []).forEach((p: any) => { productNameMap[p.id] = { name: p.name }; });

      // Try courses
      const { data: courses } = await supabase
        .from("courses")
        .select("id, name")
        .in("id", uniqueOfferIds);
      (courses || []).forEach((c: any) => { productNameMap[c.id] = { name: c.name }; });

      // Try combos
      const { data: combos } = await supabase
        .from("combos")
        .select("id, name")
        .in("id", uniqueOfferIds);
      (combos || []).forEach((c: any) => { productNameMap[c.id] = { name: c.name }; });

      // Try to get checkout URLs from upsell_sales_page_cache
      const { data: cacheEntries } = await supabase
        .from("upsell_sales_page_cache")
        .select("product_id, checkout_url")
        .in("product_id", uniqueOfferIds);
      (cacheEntries || []).forEach((entry: any) => {
        if (entry.checkout_url && productNameMap[entry.product_id]) {
          productNameMap[entry.product_id].checkout_url = entry.checkout_url;
        }
      });
    }

    let processed = 0;

    for (const lead of eligibleLeads) {
      try {
        // === CHECK IF LEAD EMAIL ALREADY HAS ENROLLMENT ===
        if (lead.email) {
          const { data: enrolledProfile } = await supabase.from("profiles").select("user_id").eq("email", lead.email).maybeSingle();
          if (enrolledProfile) {
            const [{ count: pkgCount }, { count: courseCount }, { count: comboCount }] = await Promise.all([
              supabase.from("user_packages").select("id", { count: "exact", head: true }).eq("user_id", enrolledProfile.user_id),
              supabase.from("user_courses").select("id", { count: "exact", head: true }).eq("user_id", enrolledProfile.user_id),
              supabase.from("user_combos").select("id", { count: "exact", head: true }).eq("user_id", enrolledProfile.user_id),
            ]);
            if ((pkgCount || 0) + (courseCount || 0) + (comboCount || 0) > 0) {
              console.log(`Lead ${lead.id} (${lead.email}) already enrolled, marking as converted`);
              await supabase.from("crm_leads").update({ stage: "convertido", converted_at: new Date().toISOString() }).eq("id", lead.id);
              await supabase.from("crm_lead_activities").insert({
                lead_id: lead.id, activity_type: "stage_change",
                description: "Convertido automaticamente no nurturing: email já possui matrícula ativa",
                metadata: { source: "crm-nurturing-cron" },
              });
              processed++;
              continue;
            }
          }
        }
        // Find alternative product via upsell rules
        let offerProduct: { id: string; name: string; checkout_url?: string } | null = null;

        if (lead.product_id && upsellRules) {
          const matchingRule = upsellRules.find(
            (r: any) => r.trigger_product_id === lead.product_id
          );
          if (matchingRule) {
            const info = productNameMap[matchingRule.offer_product_id];
            if (info) {
              offerProduct = {
                id: matchingRule.offer_product_id,
                name: info.name,
                checkout_url: info.checkout_url,
              };
            }
          }
        }

        // Move lead to nurturing stage
        await supabase
          .from("crm_leads")
          .update({ stage: nurturingStage })
          .eq("id", lead.id);

        // Log activity
        const description = offerProduct
          ? `Movido automaticamente para Oferta Alternativa. Produto sugerido: ${offerProduct.name}`
          : `Movido automaticamente para Oferta Alternativa (sem produto alternativo encontrado)`;

        await supabase.from("crm_lead_activities").insert({
          lead_id: lead.id,
          activity_type: "automation",
          description,
          metadata: offerProduct
            ? { offer_product_id: offerProduct.id, offer_product_name: offerProduct.name }
            : {},
        });

        // Send WhatsApp if phone + binding + offer product exist
        if (lead.phone && bindings && bindings.length > 0 && offerProduct) {
          // Pick random binding
          const binding = bindings[Math.floor(Math.random() * bindings.length)] as any;
          const conn = binding.zapi_connections;

          if (conn) {
            // Build message from template variable map
            const variableMap = binding.variable_map || {};
            const variables: Record<string, string> = {};

            for (const [idx, sysVar] of Object.entries(variableMap)) {
              switch (sysVar) {
                case "lead_name":
                  variables[idx] = lead.name?.split(" ")[0] || "Cliente";
                  break;
                case "product_name":
                  variables[idx] = offerProduct.name;
                  break;
                case "checkout_url":
                  if (offerProduct.checkout_url) {
                    try { variables[idx] = await shortenUrl(supabase, offerProduct.checkout_url, "crm_nurturing", offerProduct.name); }
                    catch { variables[idx] = offerProduct.checkout_url; }
                  }
                  break;
                default:
                  variables[idx] = "";
              }
            }

            // Filter out empty variables
            const params = Object.entries(variables)
              .filter(([, v]) => v && v.trim() !== "")
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([, v]) => v);

            if (conn.provider === "era_cloud" && conn.api_url && conn.token) {
              // Send directly via Era Cloud API
              try {
                const phone = lead.phone.replace(/\D/g, "");
                const res = await fetch(`${conn.api_url}/v1/messages`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": conn.token,
                  },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone,
                    type: "template",
                    template: {
                      name: binding.template_name,
                      language: { code: "pt_BR" },
                      components: params.length > 0
                        ? [
                            {
                              type: "body",
                              parameters: params.map((p: string) => ({
                                type: "text",
                                text: p,
                              })),
                            },
                          ]
                        : [],
                    },
                  }),
                });

                if (!res.ok) {
                  const errText = await res.text();
                  console.error(`Era Cloud send failed for lead ${lead.id}:`, errText);
                } else {
                  console.log(`WhatsApp sent to lead ${lead.id} via Era Cloud`);
                }
              } catch (sendErr) {
                console.error(`Error sending WhatsApp for lead ${lead.id}:`, sendErr);
              }
            } else {
              // Queue via whatsapp_send_queue for Z-API
              const message = `Template: ${binding.template_name} | Params: ${params.join(", ")}`;
              await supabase.from("whatsapp_send_queue").insert({
                phone: lead.phone.replace(/\D/g, ""),
                message,
                context_type: "crm_nurturing",
                context_data: {
                  lead_id: lead.id,
                  template_name: binding.template_name,
                  parameters: params,
                },
                priority: 5,
                zapi_connection_id: conn.id,
              });
            }

            // Log WhatsApp activity
            await supabase.from("crm_lead_activities").insert({
              lead_id: lead.id,
              activity_type: "whatsapp",
              description: `WhatsApp de oferta alternativa enviado: ${offerProduct.name}`,
              metadata: {
                template: binding.template_name,
                offer_product: offerProduct.name,
              },
            });
          }
        }

        processed++;
      } catch (leadErr) {
        console.error(`Error processing lead ${lead.id}:`, leadErr);
      }
    }

    console.log(`Nurturing complete: ${processed}/${eligibleLeads.length} leads processed`);

    return new Response(
      JSON.stringify({ ok: true, processed, total: eligibleLeads.length, escalation: escalationResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Nurturing cron error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
