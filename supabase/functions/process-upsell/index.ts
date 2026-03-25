import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses@3.485.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOTAL_SEQUENCE_EMAILS = 9;
const BASE_URL = "https://alunos.criminallab.com.br";
const MAX_NEW_SEQUENCES_PER_RUN = 500;
const MAX_PROGRESS_PER_RUN = 100; // Reserve most slots for time trigger (larger backlog)
const MAX_PART_A_SEQUENCES = 300; // Budget: max active sequences to process per run (temporarily increased from 100)

function appendUtmParams(url: string | null, params: Record<string, string>): string {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${url}${separator}${query}`;
}

async function createRedirectLink(
  supabase: any,
  destinationUrl: string,
  source: string,
  productName: string,
): Promise<string> {
  const code = crypto.randomUUID().replace(/-/g, '');
  await supabase.from("redirect_links").insert({
    code,
    destination_url: destinationUrl,
    source,
    product_name: productName,
  });
  return `${BASE_URL}/?trigger=${code}`;
}

const EMAIL_SCHEDULE: Record<number, { day: number; period: "morning" | "midday" | "evening" }> = {
  1: { day: 1, period: "morning" },
  2: { day: 1, period: "evening" },
  3: { day: 2, period: "morning" },
  4: { day: 2, period: "evening" },
  5: { day: 3, period: "morning" },
  6: { day: 3, period: "evening" },
  7: { day: 4, period: "morning" },
  8: { day: 4, period: "midday" },
  9: { day: 4, period: "evening" },
};

// WhatsApp: 1 message per day, 4 days total (independent of email schedule)
const WHATSAPP_SCHEDULE: Record<number, number> = {
  1: 1, // Day 1
  2: 2, // Day 2
  3: 3, // Day 3
  4: 4, // Day 4
};

function shouldSendNow(sequenceCreatedAt: string, nextStep: number): boolean {
  const schedule = EMAIL_SCHEDULE[nextStep];
  if (!schedule) return false;

  const created = new Date(sequenceCreatedAt);
  const now = new Date();

  const targetDate = new Date(created);
  targetDate.setDate(targetDate.getDate() + (schedule.day - 1));

  const nowDateStr = now.toISOString().slice(0, 10);
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  if (nowDateStr < targetDateStr) return false;

  const currentHour = now.getUTCHours();

  const periodWindows = {
    morning: { start: 12, end: 15 },
    midday:  { start: 16, end: 19 },
    evening: { start: 22, end: 25 },
  };

  const window = periodWindows[schedule.period];

  if (nowDateStr > targetDateStr) return true;

  const adjustedHour = currentHour < window.start && window.end > 24 ? currentHour + 24 : currentHour;
  return adjustedHour >= window.start && adjustedHour < window.end;
}

const sesClient = new SESClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID") || "",
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
  },
});

async function sendEmailViaSES(params: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const command = new SendEmailCommand({
    Source: params.from,
    Destination: { ToAddresses: params.to },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: { Html: { Data: params.html, Charset: "UTF-8" } },
    },
    ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
    Tags: [{ Name: "email_type", Value: "transactional" }],
  });
  return sesClient.send(command);
}

// ===== Era Cloud helper functions =====
interface EraCloudConnection {
  provider: string;
  connectionId: string;
  token: string;
  apiUrl: string;
}

const UPSELL_CONNECTION_ID = "c0332f67-c559-4a6a-b406-68691bdd780b";

async function getUpsellConnection(supabase: any): Promise<EraCloudConnection | null> {
  const { data: creds } = await supabase.rpc("get_zapi_credentials", { p_connection_id: UPSELL_CONNECTION_ID });
  if (!creds?.[0]) return null;
  return { provider: "era_cloud", connectionId: UPSELL_CONNECTION_ID, token: creds[0].token, apiUrl: creds[0].api_url };
}

async function sendUpsellTemplate(phone: string, templateName: string, parameters: string[], conn: EraCloudConnection): Promise<any> {
  const url = `${conn.apiUrl}/v1/messages`;
  const body = {
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [{ type: "body", parameters: parameters.map((p) => ({ type: "text", text: p })) }],
    },
  };
  console.log(`[process-upsell] Sending template '${templateName}' to ${phone}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": conn.token },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Era Cloud template error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function sendDirectText(phone: string, message: string, conn: EraCloudConnection): Promise<any> {
  const url = `${conn.apiUrl}/v1/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": conn.token },
    body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Era Cloud text error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function renderTemplateBody(supabase: any, connectionId: string, templateName: string, parameters: string[]): Promise<Record<string, any>> {
  const meta: Record<string, any> = { template_name: templateName };
  const { data: tplData } = await supabase
    .from("whatsapp_templates")
    .select("components")
    .eq("connection_id", connectionId)
    .eq("name", templateName)
    .maybeSingle();
  if (tplData?.components && Array.isArray(tplData.components)) {
    for (const comp of tplData.components as any[]) {
      if (comp.type === "BODY" && comp.text) {
        let body = comp.text as string;
        parameters.forEach((p, i) => { body = body.replace(`{{${i + 1}}}`, p); });
        meta.template_body = body;
      }
      if (comp.type === "HEADER" && comp.text) {
        meta.template_header = comp.text;
      }
    }
  }
  return meta;
}

async function saveUpsellMessageToConversation(supabase: any, phone: string, content: string, connectionId: string, messageId: string | null, metadata?: Record<string, any>) {
  const { data: existingConv } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();

  let convId = existingConv?.id;
  if (!convId) {
    const { data: profile } = await supabase.from("profiles").select("id, full_name").or(`phone.eq.${phone},phone.eq.+${phone}`).maybeSingle();
    const { data: newConv } = await supabase
      .from("whatsapp_conversations")
      .insert({ phone, profile_id: profile?.id || null, contact_name: profile?.full_name || null, last_message_at: new Date().toISOString(), last_message_preview: content.substring(0, 100), status: "open", zapi_connection_id: connectionId })
      .select("id")
      .single();
    convId = newConv?.id;
  } else {
    await supabase.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: content.substring(0, 100), zapi_connection_id: connectionId }).eq("id", convId);
  }

  if (convId) {
    const msgMeta = { source: "upsell_flow", ...(metadata || {}) };
    await supabase.from("whatsapp_messages").insert({ conversation_id: convId, direction: "outbound", message_type: metadata?.template_name ? "template" : "text", content, zapi_message_id: messageId, status: "sent", metadata: msgMeta });
  }
}

async function resolveUpsellTemplate(
  supabase: any, connectionId: string, whatsappStep: number, fallbackTemplateName: string,
  studentName: string, productName: string
): Promise<{ templateName: string; parameters: string[] }> {
  const processKey = `upsell_${whatsappStep}`;
  // Fetch ALL active bindings for this process (supports multiple templates)
  const { data: allBindings } = await supabase
    .from("whatsapp_template_bindings")
    .select("template_name, variable_map")
    .eq("connection_id", connectionId)
    .eq("process", processKey)
    .eq("is_active", true);

  // Pick one randomly if multiple exist
  const binding = allBindings && allBindings.length > 0
    ? allBindings[Math.floor(Math.random() * allBindings.length)]
    : null;

  if (binding && Object.keys(binding.variable_map || {}).length > 0) {
    const varMap = binding.variable_map as Record<string, string>;
    const variableValues: Record<string, string> = { student_name: studentName, product_name: productName };
    const maxIdx = Math.max(...Object.keys(varMap).map(Number));
    const parameters: string[] = [];
    for (let i = 1; i <= maxIdx; i++) {
      const sysVar = varMap[String(i)] || "";
      parameters.push(variableValues[sysVar] || "");
    }
    console.log(`[process-upsell] Selected template '${binding.template_name}' randomly from ${allBindings!.length} binding(s) for ${processKey}`);
    return { templateName: binding.template_name, parameters };
  }

  // Fallback
  return { templateName: binding?.template_name || fallbackTemplateName, parameters: [studentName, productName] };
}

async function sendUpsellViaEraCloud(
  supabase: any, phone: string, fallbackTemplateName: string, studentName: string, productName: string, aiMessage: string, conn: EraCloudConnection, whatsappStep: number = 1
): Promise<{ templateMessageId: string | null; textMessageId: string | null }> {
  // Resolve template binding
  const { templateName, parameters } = await resolveUpsellTemplate(
    supabase, conn.connectionId, whatsappStep, fallbackTemplateName, studentName, productName
  );

  // Step 1: Send template to open 24h window
  const templateRes = await sendUpsellTemplate(phone, templateName, parameters, conn);
  const templateMessageId = templateRes.messages?.[0]?.id || templateRes.messageId || null;
  const templateContent = `[Template ${templateName}] ${parameters.join(", ")}`;
  const templateMeta = await renderTemplateBody(supabase, conn.connectionId, templateName, parameters);
  await saveUpsellMessageToConversation(supabase, phone, templateContent, conn.connectionId, templateMessageId, templateMeta);

  // Step 2: Wait 3 seconds for window to open
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 3: Send AI message as text
  const textRes = await sendDirectText(phone, aiMessage, conn);
  const textMessageId = textRes.messages?.[0]?.id || textRes.messageId || null;
  await saveUpsellMessageToConversation(supabase, phone, aiMessage, conn.connectionId, textMessageId);

  return { templateMessageId, textMessageId };
}

function normalizePhoneForUpsell(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

// Business hours check: only send WhatsApp between 8h and 21h BRT (UTC-3)
function isWithinBusinessHours(): boolean {
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  return brtHour >= 8 && brtHour < 21;
}

function getNextBusinessHourSchedule(): string {
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  // If before 8am BRT today, schedule for 8am BRT today (11:00 UTC)
  // If after 21pm BRT today, schedule for 8am BRT tomorrow (11:00 UTC)
  const target = new Date(now);
  if (brtHour >= 21) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  target.setUTCHours(11, 0, 0, 0); // 8am BRT = 11:00 UTC
  return target.toISOString();
}

async function isWindowOpen(supabase: any, phone: string): Promise<boolean> {
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();
  if (!conv) return false;

  const { data: lastInbound } = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("conversation_id", conv.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastInbound) return false;

  const hoursSince = (Date.now() - new Date(lastInbound.created_at).getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.targetUserId || null;
    } catch { /* no body or invalid json */ }

    // 1. Check if upsell is enabled
    const { data: upsellSettings } = await supabase
      .from("upsell_settings")
      .select("*")
      .limit(1)
      .single();

    if (!upsellSettings?.is_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Upsell system is disabled", sent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const threshold = upsellSettings.progress_threshold || 60;
    const cooldownDays = upsellSettings.cooldown_days || 15;
    const enrollmentDaysTrigger = upsellSettings.enrollment_days_trigger || 10;

    // 2. Get email settings, template, and unsubscribes
    const [emailSettingsRes, templateRes, unsubscribesRes] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "upsell-offer").single(),
      supabase.from("upsell_unsubscribes").select("user_id"),
    ]);

    const senderName = emailSettingsRes.data?.sender_name || "Criminal Lab";
    const senderEmail = emailSettingsRes.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = emailSettingsRes.data?.reply_to_email || undefined;
    const emailTemplate = templateRes.data?.html_body || "";

    // Build unsubscribe set
    const unsubscribedUsers = new Set((unsubscribesRes.data || []).map((u: any) => u.user_id));

    if (!emailTemplate) {
      console.warn("No upsell-offer email template found");
      return new Response(
        JSON.stringify({ success: false, error: "Email template 'upsell-offer' not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Helper to fetch all rows with pagination (Supabase default limit is 1000)
    async function fetchAll(table: string, selectCols: string, filters?: { column: string; op: string; value: any }[]) {
      const allRows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        let query = supabase.from(table).select(selectCols).range(from, from + pageSize - 1);
        if (filters) {
          for (const f of filters) {
            if (f.op === "eq") query = query.eq(f.column, f.value);
            if (f.op === "in") query = query.in(f.column, f.value);
          }
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    }

    // 3. Get admin IDs and user_packages first to limit scope
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "editor"]);
    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    // Get all user_packages, user_courses, and user_combos first
    const allUserPkgs = await fetchAll("user_packages", "user_id, package_id, purchased_at");
    const allUserCourses = await fetchAll("user_courses", "user_id, course_id, purchased_at");
    const allUserCombos = await fetchAll("user_combos", "user_id, combo_id, purchased_at");

    // Only fetch profiles for users who have packages or courses (or targetUserId)
    const usersWithProducts = new Set<string>();
    for (const up of allUserPkgs) usersWithProducts.add(up.user_id);
    for (const uc of allUserCourses) usersWithProducts.add(uc.user_id);
    for (const ucb of allUserCombos) usersWithProducts.add(ucb.user_id);

    let allProfiles: any[];
    if (targetUserId) {
      const { data } = await supabase.from("profiles").select("user_id, email, full_name, phone").eq("user_id", targetUserId).single();
      allProfiles = data ? [data] : [];
    } else {
      // Fetch profiles only for users with products (batch in chunks of 200)
      const productUserIds = Array.from(usersWithProducts);
      allProfiles = [];
      for (let i = 0; i < productUserIds.length; i += 200) {
        const chunk = productUserIds.slice(i, i + 200);
        const { data } = await supabase.from("profiles").select("user_id, email, full_name, phone").in("user_id", chunk);
        if (data) allProfiles.push(...data);
      }
    }

    let students: any[];
    if (targetUserId) {
      students = allProfiles;
    } else {
      students = allProfiles.filter((p: any) => !adminIds.has(p.user_id));
    }

    console.log(`Processing ${students.length} students with products (out of ${usersWithProducts.size} product owners)`);

    if (students.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No students with products found", sent: 0 }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 4. Get ALL upsell sequences
    const allSequences = await fetchAll("upsell_sequences", "*");

    const activeSequences: any[] = [];
    const offeredProducts = new Map<string, Set<string>>();
    const completedSequenceDates = new Map<string, Date>();

    for (const seq of (allSequences || [])) {
      if (!offeredProducts.has(seq.user_id)) offeredProducts.set(seq.user_id, new Set());
      offeredProducts.get(seq.user_id)!.add(`${seq.product_type}:${seq.product_id}`);

      if (seq.status === "active" && seq.emails_sent < TOTAL_SEQUENCE_EMAILS) {
        activeSequences.push(seq);
      }

      if (seq.status === "completed" || seq.status === "cancelled" || seq.status === "converted") {
        const seqDate = new Date(seq.updated_at);
        const existing = completedSequenceDates.get(seq.user_id);
        if (!existing || seqDate > existing) {
          completedSequenceDates.set(seq.user_id, seqDate);
        }
      }
    }

    const usersWithActiveSeq = new Set(activeSequences.map((s) => s.user_id));

    // 5. Get all packages, courses, combos, and recipe_packages
    const [allPackages, allCourses, allCombos, allRecipePkgs] = await Promise.all([
      supabase.from("packages").select("id, name, description, hotmart_product_code, is_free, is_available_for_sale, is_active").then(r => r.data || []),
      supabase.from("courses").select("id, name, description, hotmart_product_code, is_free, is_available_for_sale, is_active").then(r => r.data || []),
      supabase.from("combos").select("id, name, description, hotmart_product_code, is_free, is_available_for_sale, is_active").then(r => r.data || []),
      fetchAll("recipe_packages", "recipe_id, package_id"),
    ]);

    const packageMap = new Map(allPackages.map((p: any) => [p.id, p]));

    const sellablePackages = allPackages.filter(
      (p: any) => p.is_active && p.is_available_for_sale && !p.is_free && p.hotmart_product_code
    );
    const sellableCourses = allCourses.filter(
      (c: any) => c.is_active && c.is_available_for_sale && !c.is_free && c.hotmart_product_code
    );
    const sellableCombos = allCombos.filter(
      (cb: any) => cb.is_active && cb.is_available_for_sale && !cb.is_free && cb.hotmart_product_code
    );

    console.log(`[process-upsell] Sellable catalog: ${sellableCourses.length} courses, ${sellablePackages.length} packages, ${sellableCombos.length} combos`);

    // Load affinity rules from upsell_product_rules
    const { data: productRulesData } = await supabase
      .from("upsell_product_rules" as any)
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });
    const productRules: any[] = productRulesData || [];

    // Build lookup maps for offer products by id
    const courseById = new Map(allCourses.map((c: any) => [c.id, c]));
    const packageById = new Map(allPackages.map((p: any) => [p.id, p]));
    const comboById = new Map(allCombos.map((cb: any) => [cb.id, cb]));

    // Helper: find the first matching affinity rule offer for a user
    function findRuleOffer(
      ownedCourseIds: Set<string>,
      ownedPkgIds: Set<string>,
      ownedComboIds: Set<string>,
      alreadyOffered: Set<string>
    ): { product: any; type: "course" | "package" | "combo" } | null {
      for (const rule of productRules) {
        const triggerOwned =
          rule.trigger_product_type === "course"
            ? ownedCourseIds.has(rule.trigger_product_id)
            : rule.trigger_product_type === "combo"
            ? ownedComboIds.has(rule.trigger_product_id)
            : ownedPkgIds.has(rule.trigger_product_id);
        if (!triggerOwned) continue;

        const offerKey = `${rule.offer_product_type}:${rule.offer_product_id}`;
        const alreadyOwned =
          rule.offer_product_type === "course"
            ? ownedCourseIds.has(rule.offer_product_id)
            : rule.offer_product_type === "combo"
            ? ownedComboIds.has(rule.offer_product_id)
            : ownedPkgIds.has(rule.offer_product_id);

        if (alreadyOwned || alreadyOffered.has(offerKey)) continue;

        const offerProduct =
          rule.offer_product_type === "course"
            ? courseById.get(rule.offer_product_id)
            : rule.offer_product_type === "combo"
            ? comboById.get(rule.offer_product_id)
            : packageById.get(rule.offer_product_id);

        if (!offerProduct || !offerProduct.hotmart_product_code) continue;

        return { product: offerProduct, type: rule.offer_product_type as "course" | "package" | "combo" };
      }
      return null;
    }

    const userPkgMap = new Map<string, Set<string>>();
    for (const up of allUserPkgs) {
      if (!userPkgMap.has(up.user_id)) userPkgMap.set(up.user_id, new Set());
      userPkgMap.get(up.user_id)!.add(up.package_id);
    }

    const userCourseMap = new Map<string, Set<string>>();
    for (const uc of allUserCourses) {
      if (!userCourseMap.has(uc.user_id)) userCourseMap.set(uc.user_id, new Set());
      userCourseMap.get(uc.user_id)!.add(uc.course_id);
    }

    const userComboMap = new Map<string, Set<string>>();
    for (const ucb of allUserCombos) {
      if (!userComboMap.has(ucb.user_id)) userComboMap.set(ucb.user_id, new Set());
      userComboMap.get(ucb.user_id)!.add(ucb.combo_id);
    }

    const recipesPerPkg = new Map<string, string[]>();
    for (const rp of allRecipePkgs) {
      if (!recipesPerPkg.has(rp.package_id)) recipesPerPkg.set(rp.package_id, []);
      recipesPerPkg.get(rp.package_id)!.push(rp.recipe_id);
    }

    // 6. Get completed recipe views (paginated, no filter by user to avoid huge IN clause)
    const allCompletedViews = await fetchAll("recipe_views", "user_id, recipe_id", [
      { column: "completed", op: "eq", value: true }
    ]);

    const userCompletedRecipes = new Map<string, Set<string>>();
    for (const rv of allCompletedViews) {
      if (!userCompletedRecipes.has(rv.user_id)) userCompletedRecipes.set(rv.user_id, new Set());
      userCompletedRecipes.get(rv.user_id)!.add(rv.recipe_id);
    }

    const profileMap = new Map(students.map((s: any) => [s.user_id, s]));

    let sent = 0;
    let whatsappSent = 0;
    let newSequencesCreated = 0;
    let newSequencesProgress = 0;
    let newSequencesTime = 0;
    const errors: { email: string; error: string }[] = [];

    const whatsappEnabled = upsellSettings.whatsapp_enabled || false;
    const whatsappTemplateName = upsellSettings.whatsapp_template_name || 'abertura_upsell_1';

    // ===== PART A: Continue active sequences (budget: max 30 or 200s) =====
    const RUN_START = Date.now();
    let partAProcessed = 0;
    // Prioritize sequences that already started (steps 2+) over new ones (step 1)
    // This prevents the step-0 backlog from starving progression
    activeSequences.sort((a: any, b: any) => {
      const aStarted = a.emails_sent > 0 ? 0 : 1;
      const bStarted = b.emails_sent > 0 ? 0 : 1;
      if (aStarted !== bStarted) return aStarted - bStarted;
      return a.emails_sent - b.emails_sent;
    });
    for (const seq of activeSequences) {
      if (partAProcessed >= MAX_PART_A_SEQUENCES || (Date.now() - RUN_START > 200_000)) {
        console.log(`[PART A] Budget exhausted: processed=${partAProcessed}/${activeSequences.length}, elapsed=${((Date.now() - RUN_START)/1000).toFixed(0)}s — jumping to creation`);
        break;
      }
      partAProcessed++;
      const student = profileMap.get(seq.user_id);
      if (!student) continue;

      // Skip unsubscribed users
      if (unsubscribedUsers.has(seq.user_id)) {
        await supabase.from("upsell_sequences").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", seq.id);
        console.log(`Skipping unsubscribed user ${seq.user_id}, cancelling sequence`);
        continue;
      }

      // Auto-convert: check if user already has the offered product
      const userOwnedPkgs = userPkgMap.get(seq.user_id) || new Set();
      const userOwnedCourses = userCourseMap.get(seq.user_id) || new Set();
      const userOwnedCombos = userComboMap.get(seq.user_id) || new Set();
      const hasProduct = seq.product_type === "course"
        ? userOwnedCourses.has(seq.product_id)
        : seq.product_type === "combo"
        ? userOwnedCombos.has(seq.product_id)
        : userOwnedPkgs.has(seq.product_id);

      if (hasProduct) {
        await supabase.from("upsell_sequences").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", seq.id);
        console.log(`User ${seq.user_id} already has product ${seq.product_id}, marking as converted`);
        continue;
      }

      const nextStep = seq.emails_sent + 1;

      if (!shouldSendNow(seq.created_at, nextStep)) continue;

      // Dedup safety
      if (seq.last_email_at) {
        const hoursSince = (Date.now() - new Date(seq.last_email_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 2) continue;
      }

      const triggerPkg = packageMap.get(seq.trigger_module_id);
      const triggerModuleName = triggerPkg?.name || "seu módulo";

      let offerProduct: any = null;
      if (seq.product_type === "course") {
        offerProduct = allCourses.find((c: any) => c.id === seq.product_id);
      } else if (seq.product_type === "combo") {
        offerProduct = allCombos.find((cb: any) => cb.id === seq.product_id);
      } else {
        offerProduct = allPackages.find((p: any) => p.id === seq.product_id);
      }

      if (!offerProduct) {
        await supabase.from("upsell_sequences").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", seq.id);
        continue;
      }

      // Skip products without checkout URL
      if (!offerProduct.hotmart_product_code) {
        console.log(`Skipping email for ${student.email}: product "${offerProduct.name}" has no checkout URL`);
        continue;
      }

      // Atomic lock: claim this email step BEFORE sending
      const { data: claimed, error: claimErr } = await supabase
        .from("upsell_sequences")
        .update({
          emails_sent: nextStep,
          last_email_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", seq.id)
        .eq("emails_sent", seq.emails_sent)
        .select("id");

      if (claimErr || !claimed || claimed.length === 0) {
        console.log(`Email atomic lock: skipping ${student.email}, step ${nextStep} already claimed`);
        continue;
      }

      try {
        // Build unsubscribe URL for this user
        const unsubToken = btoa(JSON.stringify({ userId: seq.user_id }));
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/upsell-unsubscribe?token=${encodeURIComponent(unsubToken)}`;

        // Create redirect link with UTMs for email
        const emailCheckoutUrl = appendUtmParams(offerProduct.hotmart_product_code, {
          utm_source: "email",
          utm_medium: "upsell",
          utm_campaign: offerProduct.name,
          utm_content: `email_${nextStep}_de_9`,
        });
        const emailRedirectUrl = await createRedirectLink(supabase, emailCheckoutUrl, "email", offerProduct.name);

        const generateRes = await fetch(`${supabaseUrl}/functions/v1/generate-upsell-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            productName: offerProduct.name,
            productDescription: offerProduct.description || "",
            productType: seq.product_type,
            productId: seq.product_id,
            studentName: student.full_name || student.email.split("@")[0],
            completedModuleName: triggerModuleName,
            checkoutUrl: emailRedirectUrl,
            sequenceStep: nextStep,
            triggerType: seq.trigger_module_id ? "progress" : "time",
          }),
        });

        if (!generateRes.ok) {
          // Revert atomic lock on AI failure
          await supabase.from("upsell_sequences").update({
            emails_sent: seq.emails_sent,
            last_email_at: seq.last_email_at,
            updated_at: new Date().toISOString(),
          }).eq("id", seq.id);
          errors.push({ email: student.email, error: `AI error step ${nextStep}: ${generateRes.status}` });
          continue;
        }

        const aiResult = await generateRes.json();
        if (!aiResult.success) {
          // Revert atomic lock on AI failure
          await supabase.from("upsell_sequences").update({
            emails_sent: seq.emails_sent,
            last_email_at: seq.last_email_at,
            updated_at: new Date().toISOString(),
          }).eq("id", seq.id);
          errors.push({ email: student.email, error: aiResult.error || "AI generation failed" });
          continue;
        }

        const userName = student.full_name || student.email.split("@")[0];

        let finalHtml = emailTemplate
          .replaceAll("{{user_name}}", userName)
          .replaceAll("{{email}}", student.email)
          .replaceAll("{{product_name}}", offerProduct.name)
          .replaceAll("{{product_description}}", offerProduct.description || "")
          .replaceAll("{{checkout_url}}", emailRedirectUrl)
          .replaceAll("{{ai_personalized_content}}", aiResult.body)
          .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);

        await sendEmailViaSES({
          from: `${senderName} <${senderEmail}>`,
          to: [student.email],
          subject: aiResult.subject,
          html: finalHtml,
          replyTo,
        });

        // Update AI content and final status after successful send
        const newStatus = nextStep >= TOTAL_SEQUENCE_EMAILS ? "completed" : "active";
        await supabase.from("upsell_sequences").update({
          ai_generated_subject: aiResult.subject,
          ai_generated_body: aiResult.body,
          status: newStatus,
          updated_at: new Date().toISOString(),
        }).eq("id", seq.id);

        // Log the sent email
        await supabase.from("upsell_email_logs").insert({
          sequence_id: seq.id,
          step: nextStep,
          subject: aiResult.subject,
          body_html: aiResult.body,
          sent_at: new Date().toISOString(),
          status: "sent",
        });

        sent++;
        console.log(`Upsell email ${nextStep}/${TOTAL_SEQUENCE_EMAILS} sent to ${student.email} for ${offerProduct.name}`);

        // ===== WhatsApp: insert into queue instead of direct send =====
        if (whatsappEnabled && student.phone && seq.whatsapp_sent < 4) {
          const whatsappStep = (seq.whatsapp_sent || 0) + 1;
          // Dedup: skip if last WhatsApp was sent less than 22 hours ago (1 per day max)
          if (seq.last_whatsapp_at) {
            const hoursSinceWa = (Date.now() - new Date(seq.last_whatsapp_at).getTime()) / (1000 * 60 * 60);
            if (hoursSinceWa < 22) {
              console.log(`WhatsApp dedup: skipping ${student.phone}, last sent ${hoursSinceWa.toFixed(1)}h ago`);
              continue;
            }
          }

          // Day gate: only send if the target day for this step has been reached
          const whatsappTargetDay = WHATSAPP_SCHEDULE[whatsappStep];
          if (whatsappTargetDay) {
            const seqCreated = new Date(seq.created_at);
            const targetDate = new Date(seqCreated);
            targetDate.setDate(targetDate.getDate() + (whatsappTargetDay - 1));
            const nowStr = new Date().toISOString().slice(0, 10);
            const targetStr = targetDate.toISOString().slice(0, 10);
            if (nowStr < targetStr) {
              console.log(`WhatsApp ${whatsappStep}/4 skipped for ${student.phone}: day ${whatsappTargetDay} not reached yet (target: ${targetStr}, now: ${nowStr})`);
              continue;
            }
          }

          // === PRE-CHECKS BEFORE ATOMIC LOCK (to avoid consuming steps without sending) ===
          const normalizedPhone = normalizePhoneForUpsell(student.phone);
          const withinHours = isWithinBusinessHours();

          // Check 24h window BEFORE locking
          const windowOpen = await isWindowOpen(supabase, normalizedPhone);

          // If window is open and step >= 2: skip WITHOUT incrementing counter
          if (windowOpen && whatsappStep >= 2) {
            console.log(`WhatsApp ${whatsappStep}/4 SKIPPED for ${student.phone} (window open, AI active) - counter NOT incremented`);
            continue;
          }

          // If outside business hours: generate message and queue WITHOUT incrementing counter
          if (!withinHours) {
            try {
              const eraConn = await getUpsellConnection(supabase);

              const { data: conversation } = await supabase
                .from("whatsapp_conversations")
                .select("id")
                .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone}`)
                .maybeSingle();

              let conversationHistory: any[] = [];
              if (conversation) {
                const { data: messages } = await supabase
                  .from("whatsapp_messages")
                  .select("direction, content, created_at")
                  .eq("conversation_id", conversation.id)
                  .order("created_at", { ascending: true });
                conversationHistory = messages || [];
              }

              const waCheckoutUrl = appendUtmParams(offerProduct.hotmart_product_code, {
                utm_source: "whatsapp",
                utm_medium: "upsell",
                utm_campaign: offerProduct.name,
                utm_content: `whatsapp_${whatsappStep}_de_4`,
              });
              const waRedirectUrl = await createRedirectLink(supabase, waCheckoutUrl, "whatsapp", offerProduct.name);

              const waGenerateRes = await fetch(`${supabaseUrl}/functions/v1/generate-upsell-whatsapp`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  productName: offerProduct.name,
                  productDescription: offerProduct.description || "",
                  productType: seq.product_type,
                  productId: seq.product_id,
                  studentName: student.full_name || student.email.split("@")[0],
                  completedModuleName: triggerModuleName,
                  checkoutUrl: waRedirectUrl,
                  sequenceStep: whatsappStep,
                  conversationHistory,
                  triggerType: seq.trigger_module_id ? "progress" : "time",
                }),
              });

              if (waGenerateRes.ok) {
                const waResult = await waGenerateRes.json();
                if (waResult.optOut) {
                  await supabase.from("upsell_sequences").update({
                    status: "cancelled",
                    updated_at: new Date().toISOString(),
                  }).eq("id", seq.id);
                  console.log(`WhatsApp opt-out detected for ${student.email}, cancelling sequence. Reason: ${waResult.reasoning}`);
                } else if (waResult.message) {
                  const scheduledAt = getNextBusinessHourSchedule();
                  // Queue message but DO NOT increment whatsapp_sent - will be done when actually sent
                  await supabase.from("whatsapp_send_queue").insert({
                    phone: student.phone,
                    message: waResult.message,
                    context_type: "upsell",
                    context_data: { sequence_id: seq.id, step: whatsappStep, pending_lock: true },
                    scheduled_at: scheduledAt,
                    zapi_connection_id: UPSELL_CONNECTION_ID,
                  });
                  console.log(`WhatsApp ${whatsappStep}/4 queued for ${student.phone} (outside business hours, scheduled for ${scheduledAt}) - counter NOT incremented yet`);
                  whatsappSent++;
                }
              }
            } catch (waErr: any) {
              console.error(`Error queuing WhatsApp (outside hours) for ${student.phone}:`, waErr);
            }
            continue;
          }

          // === ATOMIC LOCK: only now increment whatsapp_sent (we know we will send) ===
          const { data: waClaimed, error: waClaimErr } = await supabase
            .from("upsell_sequences")
            .update({
              whatsapp_sent: whatsappStep,
              last_whatsapp_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", seq.id)
            .eq("whatsapp_sent", seq.whatsapp_sent)
            .select("id");

          if (waClaimErr || !waClaimed || waClaimed.length === 0) {
            console.log(`WhatsApp atomic lock: skipping ${student.phone}, already claimed by another process`);
            continue;
          }

          try {
            // Load conversation history for AI context
            const { data: conversation } = await supabase
              .from("whatsapp_conversations")
              .select("id")
              .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone}`)
              .maybeSingle();

            let conversationHistory: any[] = [];
            if (conversation) {
              const { data: messages } = await supabase
                .from("whatsapp_messages")
                .select("direction, content, created_at")
                .eq("conversation_id", conversation.id)
                .order("created_at", { ascending: true });
              conversationHistory = messages || [];
            }

            // Create redirect link with UTMs for WhatsApp
            const waCheckoutUrl = appendUtmParams(offerProduct.hotmart_product_code, {
              utm_source: "whatsapp",
              utm_medium: "upsell",
              utm_campaign: offerProduct.name,
              utm_content: `whatsapp_${whatsappStep}_de_4`,
            });
            const waRedirectUrl = await createRedirectLink(supabase, waCheckoutUrl, "whatsapp", offerProduct.name);

            const waGenerateRes = await fetch(`${supabaseUrl}/functions/v1/generate-upsell-whatsapp`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                productName: offerProduct.name,
                productDescription: offerProduct.description || "",
                productType: seq.product_type,
                productId: seq.product_id,
                studentName: student.full_name || student.email.split("@")[0],
                completedModuleName: triggerModuleName,
                checkoutUrl: waRedirectUrl,
                sequenceStep: whatsappStep,
                conversationHistory,
                triggerType: seq.trigger_module_id ? "progress" : "time",
              }),
            });

            if (waGenerateRes.ok) {
              const waResult = await waGenerateRes.json();

              if (waResult.optOut) {
                await supabase.from("upsell_sequences").update({
                  status: "cancelled",
                  updated_at: new Date().toISOString(),
                }).eq("id", seq.id);
                console.log(`WhatsApp opt-out detected for ${student.email}, cancelling sequence. Reason: ${waResult.reasoning}`);
              } else if (waResult.message) {
                const eraConn = await getUpsellConnection(supabase);

                if (eraConn) {
                  if (windowOpen) {
                    // Step 1 + window open: send text directly (no template needed)
                    const textRes = await sendDirectText(normalizedPhone, waResult.message, eraConn);
                    const textMsgId = textRes.messages?.[0]?.id || textRes.messageId || null;
                    await saveUpsellMessageToConversation(supabase, normalizedPhone, waResult.message, eraConn.connectionId, textMsgId);
                    console.log(`WhatsApp ${whatsappStep}/4 sent as TEXT (window open) to ${student.phone}`);
                  } else {
                    // Window closed: send template only
                    const { templateName, parameters } = await resolveUpsellTemplate(
                      supabase, eraConn.connectionId, whatsappStep, whatsappTemplateName,
                      student.full_name || student.email.split("@")[0], offerProduct.name
                    );
                    const templateRes = await sendUpsellTemplate(normalizedPhone, templateName, parameters, eraConn);
                    const templateMsgId = templateRes.messages?.[0]?.id || templateRes.messageId || null;
                    const templateContent = `[Template ${templateName}] ${parameters.join(", ")}`;
                    const templateMeta = await renderTemplateBody(supabase, eraConn.connectionId, templateName, parameters);
                    await saveUpsellMessageToConversation(supabase, normalizedPhone, templateContent, eraConn.connectionId, templateMsgId, templateMeta);
                    console.log(`WhatsApp ${whatsappStep}/4 sent as TEMPLATE (window closed) to ${student.phone}`);
                  }
                  await supabase.from("upsell_email_logs").insert({
                    sequence_id: seq.id, step: whatsappStep,
                    subject: `WhatsApp Dia ${whatsappStep}`,
                    body_html: waResult.message, sent_at: new Date().toISOString(),
                    status: "sent", channel: "whatsapp",
                  });
                } else {
                  console.error(`[process-upsell] Criminal Lab 3 connection not available, skipping WhatsApp for ${student.phone}`);
                }

                whatsappSent++;
              }
            }
          } catch (waErr: any) {
            console.error(`Error sending WhatsApp to ${student.phone}:`, waErr);
            // Revert atomic lock on failure
            await supabase.from("upsell_sequences").update({
              whatsapp_sent: seq.whatsapp_sent,
              last_whatsapp_at: seq.last_whatsapp_at,
              updated_at: new Date().toISOString(),
            }).eq("id", seq.id);
          }
        }
      } catch (err: any) {
        console.error(`Error sending sequence email to ${student.email}:`, err);
        // Revert atomic lock on failure
        await supabase.from("upsell_sequences").update({
          emails_sent: seq.emails_sent,
          last_email_at: seq.last_email_at,
          updated_at: new Date().toISOString(),
        }).eq("id", seq.id);
        errors.push({ email: student.email, error: err.message });
      }
    }

    // ===== PART B: Start new sequences for eligible students (progress trigger) =====
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - cooldownDays);

    // Build last purchase date map for time-based trigger
    const lastPurchaseMap = new Map<string, Date>();
    for (const up of allUserPkgs) {
      const d = new Date(up.purchased_at);
      const existing = lastPurchaseMap.get(up.user_id);
      if (!existing || d > existing) lastPurchaseMap.set(up.user_id, d);
    }
    for (const uc of allUserCourses) {
      const d = new Date(uc.purchased_at);
      const existing = lastPurchaseMap.get(uc.user_id);
      if (!existing || d > existing) lastPurchaseMap.set(uc.user_id, d);
    }
    for (const ucb of allUserCombos) {
      const d = new Date(ucb.purchased_at);
      const existing = lastPurchaseMap.get(ucb.user_id);
      if (!existing || d > existing) lastPurchaseMap.set(ucb.user_id, d);
    }

    const usersTriggeredByProgress = new Set<string>();

    for (const student of students) {
      if (newSequencesProgress >= MAX_PROGRESS_PER_RUN || newSequencesCreated >= MAX_NEW_SEQUENCES_PER_RUN) break;
      const userId = student.user_id;

      if (usersWithActiveSeq.has(userId)) continue;
      if (unsubscribedUsers.has(userId)) continue;

      const lastCompleted = completedSequenceDates.get(userId);
      if (lastCompleted && lastCompleted > cooldownDate) continue;

      const ownedPkgIds = userPkgMap.get(userId) || new Set();
      const completedRecipes = userCompletedRecipes.get(userId) || new Set();

      let triggerModuleId: string | null = null;

      for (const pkgId of ownedPkgIds) {
        const pkgRecipes = recipesPerPkg.get(pkgId);
        if (!pkgRecipes || pkgRecipes.length === 0) continue;

        const completed = pkgRecipes.filter((rid) => completedRecipes.has(rid)).length;
        const progress = (completed / pkgRecipes.length) * 100;

        if (progress >= threshold) {
          triggerModuleId = pkgId;
          break;
        }
      }

      if (!triggerModuleId) continue;

      const ownedCourseIds = userCourseMap.get(userId) || new Set();
      const ownedComboIds = userComboMap.get(userId) || new Set();
      const alreadyOffered = offeredProducts.get(userId) || new Set();

      let offerProduct: any = null;
      let offerType: "course" | "package" | "combo" = "course";

      const ruleResult = findRuleOffer(ownedCourseIds, ownedPkgIds, ownedComboIds, alreadyOffered);
      if (ruleResult) {
        offerProduct = ruleResult.product;
        offerType = ruleResult.type;
      }

      if (!offerProduct) {
        for (const combo of sellableCombos) {
          if (!ownedComboIds.has(combo.id) && !alreadyOffered.has(`combo:${combo.id}`)) {
            offerProduct = combo; offerType = "combo"; break;
          }
        }
      }
      if (!offerProduct) {
        for (const course of sellableCourses) {
          if (!ownedCourseIds.has(course.id) && !alreadyOffered.has(`course:${course.id}`)) {
            offerProduct = course; offerType = "course"; break;
          }
        }
      }
      if (!offerProduct) {
        for (const pkg of sellablePackages) {
          if (!ownedPkgIds.has(pkg.id) && !alreadyOffered.has(`package:${pkg.id}`)) {
            offerProduct = pkg; offerType = "package"; break;
          }
        }
      }

      if (!offerProduct) continue;

      // Race condition guard
      const { data: existingSeq } = await supabase
        .from("upsell_sequences")
        .select("id")
        .eq("user_id", userId)
        .eq("product_type", offerType)
        .eq("product_id", offerProduct.id)
        .eq("status", "active")
        .maybeSingle();

      if (existingSeq) continue;

      // INSERT only — no AI, no email, no WhatsApp. PART A will handle first send.
      await supabase.from("upsell_sequences").insert({
        user_id: userId,
        product_type: offerType,
        product_id: offerProduct.id,
        trigger_module_id: triggerModuleId,
        status: "active",
        emails_sent: 0,
        whatsapp_sent: 0,
      });

      // Track to avoid duplicate offers in same run
      if (!offeredProducts.has(userId)) offeredProducts.set(userId, new Set());
      offeredProducts.get(userId)!.add(`${offerType}:${offerProduct.id}`);
      usersWithActiveSeq.add(userId);

      newSequencesCreated++;
      newSequencesProgress++;
      usersTriggeredByProgress.add(userId);
      console.log(`[PART B] Sequence created for ${student.email} → ${offerProduct.name} (progress) [${newSequencesCreated}/${MAX_NEW_SEQUENCES_PER_RUN}]`);
    }

    // ===== PART C: Start new sequences for time-based trigger (enrollment_days_trigger) =====
    const enrollmentCutoff = new Date();
    enrollmentCutoff.setDate(enrollmentCutoff.getDate() - enrollmentDaysTrigger);

    for (const student of students) {
      if (newSequencesCreated >= MAX_NEW_SEQUENCES_PER_RUN) break;
      const userId = student.user_id;

      if (usersTriggeredByProgress.has(userId)) continue;
      if (usersWithActiveSeq.has(userId)) continue;
      if (unsubscribedUsers.has(userId)) continue;

      const lastCompleted = completedSequenceDates.get(userId);
      if (lastCompleted && lastCompleted > cooldownDate) continue;

      const lastPurchase = lastPurchaseMap.get(userId);
      if (!lastPurchase || lastPurchase > enrollmentCutoff) continue;

      const ownedPkgIds = userPkgMap.get(userId) || new Set();
      const ownedCourseIds = userCourseMap.get(userId) || new Set();
      const ownedComboIds = userComboMap.get(userId) || new Set();
      const alreadyOffered = offeredProducts.get(userId) || new Set();

      let offerProduct: any = null;
      let offerType: "course" | "package" | "combo" = "course";

      const ruleResultC = findRuleOffer(ownedCourseIds, ownedPkgIds, ownedComboIds, alreadyOffered);
      if (ruleResultC) {
        offerProduct = ruleResultC.product;
        offerType = ruleResultC.type;
      }

      if (!offerProduct) {
        for (const combo of sellableCombos) {
          if (!ownedComboIds.has(combo.id) && !alreadyOffered.has(`combo:${combo.id}`)) {
            offerProduct = combo; offerType = "combo"; break;
          }
        }
      }
      if (!offerProduct) {
        for (const course of sellableCourses) {
          if (!ownedCourseIds.has(course.id) && !alreadyOffered.has(`course:${course.id}`)) {
            offerProduct = course; offerType = "course"; break;
          }
        }
      }
      if (!offerProduct) {
        for (const pkg of sellablePackages) {
          if (!ownedPkgIds.has(pkg.id) && !alreadyOffered.has(`package:${pkg.id}`)) {
            offerProduct = pkg; offerType = "package"; break;
          }
        }
      }

      if (!offerProduct) continue;

      // Use last purchased package as trigger context
      let triggerModuleId: string | null = null;
      for (const up of allUserPkgs) {
        if (up.user_id === userId) {
          const d = new Date(up.purchased_at);
          if (d.getTime() === lastPurchase.getTime()) {
            triggerModuleId = up.package_id;
            break;
          }
        }
      }

      // Race condition guard
      const { data: existingSeqC } = await supabase
        .from("upsell_sequences")
        .select("id")
        .eq("user_id", userId)
        .eq("product_type", offerType)
        .eq("product_id", offerProduct.id)
        .eq("status", "active")
        .maybeSingle();

      if (existingSeqC) continue;

      // INSERT only — no AI, no email, no WhatsApp. PART A will handle first send.
      await supabase.from("upsell_sequences").insert({
        user_id: userId,
        product_type: offerType,
        product_id: offerProduct.id,
        trigger_module_id: triggerModuleId,
        status: "active",
        emails_sent: 0,
        whatsapp_sent: 0,
      });

      if (!offeredProducts.has(userId)) offeredProducts.set(userId, new Set());
      offeredProducts.get(userId)!.add(`${offerType}:${offerProduct.id}`);
      usersWithActiveSeq.add(userId);

      newSequencesCreated++;
      newSequencesTime++;
      console.log(`[PART C] Sequence created for ${student.email} → ${offerProduct.name} (time trigger) [${newSequencesCreated}/${MAX_NEW_SEQUENCES_PER_RUN}]`);
    }

    const eligibleForTime = students.filter(s => {
      if (usersWithActiveSeq.has(s.user_id) || unsubscribedUsers.has(s.user_id)) return false;
      const lc = completedSequenceDates.get(s.user_id);
      if (lc && lc > cooldownDate) return false;
      const lp = lastPurchaseMap.get(s.user_id);
      return lp && lp <= enrollmentCutoff;
    }).length;

    console.log(`[process-upsell] Summary: new=${newSequencesCreated}/${MAX_NEW_SEQUENCES_PER_RUN} (progress=${newSequencesProgress}, time=${newSequencesTime}), continued=${sent - newSequencesCreated}, remaining_time_eligible≈${eligibleForTime - newSequencesTime}, whatsapp=${whatsappSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        whatsappSent,
        newSequencesCreated,
        newSequencesProgress,
        newSequencesTime,
        totalStudents: students.length,
        activeSequences: activeSequences.length,
        remainingTimeEligible: eligibleForTime - newSequencesTime,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in process-upsell:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
