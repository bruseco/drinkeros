// NIBO sync — cria cliente, lança receita e emite NF-e a cada venda.
// Disparado por: stripe-webhook, mercadopago-webhook (auto) e botão Admin (manual).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NIBO_BASE = "https://api.nibo.com.br/empresas/v1";
const NIBO_TOKEN = Deno.env.get("NIBO_API_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type OrderRow = {
  id: string;
  user_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  product_type: string;
  product_name: string;
  amount: number | null;
  currency: string | null;
  purchased_at: string;
  external_ref: string | null;
};

async function nibo<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const res = await fetch(`${NIBO_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      apitoken: NIBO_TOKEN,
      ...(init.headers || {}),
    },
  });
  const raw = await res.text();
  let data: T | null = null;
  try {
    data = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    /* keep raw */
  }
  return { ok: res.ok, status: res.status, data, raw };
}

async function getOrder(orderId: string): Promise<OrderRow | null> {
  const { data, error } = await supabase.rpc("nibo_get_order", { p_order_id: orderId });
  if (error) {
    console.error("nibo_get_order error", error);
    return null;
  }
  const list = (data as OrderRow[]) || [];
  return list[0] || null;
}

async function upsertCustomer(order: OrderRow): Promise<{
  id: string | null;
  status: "success" | "skipped" | "failed";
  error?: string;
  raw?: unknown;
}> {
  if (!order.buyer_email) {
    return { id: null, status: "failed", error: "Comprador sem e-mail" };
  }

  // Busca CPF do profile
  let cpf: string | null = null;
  if (order.user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("cpf")
      .eq("user_id", order.user_id)
      .maybeSingle();
    cpf = prof?.cpf?.replace(/\D/g, "") || null;
  }

  // Tenta achar cliente existente por e-mail
  const search = await nibo<{ items?: Array<{ id: string }> }>(
    `/customers?$filter=email eq '${encodeURIComponent(order.buyer_email)}'&$top=1`,
    { method: "GET" },
  );
  if (search.ok && search.data?.items?.[0]?.id) {
    return { id: search.data.items[0].id, status: "success", raw: search.data };
  }

  // Cria
  const body: Record<string, unknown> = {
    name: order.buyer_name || order.buyer_email,
    email: order.buyer_email,
    communication: { contactName: order.buyer_name || undefined, email: order.buyer_email },
  };
  if (cpf && cpf.length === 11) {
    body.document = { number: cpf, type: "Cpf" };
  } else if (cpf && cpf.length === 14) {
    body.document = { number: cpf, type: "Cnpj" };
  }
  if (order.buyer_phone) {
    body.phone = { number: order.buyer_phone.replace(/\D/g, "") };
  }

  const created = await nibo<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!created.ok || !created.data?.id) {
    return {
      id: null,
      status: "failed",
      error: `customers POST ${created.status}: ${created.raw.slice(0, 400)}`,
    };
  }
  return { id: created.data.id, status: "success", raw: created.data };
}

async function createSchedule(order: OrderRow, customerId: string) {
  const dueDate = order.purchased_at.slice(0, 10);
  const body = {
    stakeholderId: customerId,
    dueDate,
    scheduleDate: dueDate,
    value: Number(order.amount || 0),
    description: `${order.product_name} (#${order.id})`,
    reference: order.external_ref || order.id,
    isPaid: true,
  };
  const r = await nibo<{ id: string }>("/schedules/credit", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    id: r.data?.id || null,
    status: r.ok ? ("success" as const) : ("failed" as const),
    error: r.ok ? undefined : `schedules POST ${r.status}: ${r.raw.slice(0, 400)}`,
    raw: r.data ?? r.raw,
  };
}

async function getServiceIdForType(productType: string): Promise<{ id: string | null; name: string | null }> {
  const { data } = await supabase
    .from("nibo_service_mappings")
    .select("nibo_service_id, nibo_service_name")
    .eq("product_type", productType)
    .maybeSingle();
  return { id: data?.nibo_service_id || null, name: data?.nibo_service_name || null };
}

async function emitInvoice(order: OrderRow, customerId: string) {
  const mapping = await getServiceIdForType(order.product_type);
  if (!mapping.id) {
    return {
      id: null,
      status: "failed" as const,
      error: `Sem mapeamento NIBO para product_type="${order.product_type}". Configure em /admin/nibo.`,
      raw: null,
    };
  }
  const body = {
    stakeholderId: customerId,
    serviceId: mapping.id,
    serviceDescription: order.product_name,
    serviceValue: Number(order.amount || 0),
    referenceDate: order.purchased_at.slice(0, 10),
    issueDate: new Date().toISOString().slice(0, 10),
  };
  const r = await nibo<{ id: string }>("/invoices/serviceinvoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    id: r.data?.id || null,
    status: r.ok ? ("success" as const) : ("failed" as const),
    error: r.ok ? undefined : `invoice POST ${r.status}: ${r.raw.slice(0, 400)}`,
    raw: r.data ?? r.raw,
  };
}

async function processOrder(orderId: string) {
  if (!NIBO_TOKEN) {
    return { ok: false, error: "NIBO_API_TOKEN não configurado" };
  }
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: `Pedido ${orderId} não encontrado` };

  // Upsert no log
  const baseLog = {
    order_id: order.id,
    user_id: order.user_id,
    buyer_email: order.buyer_email,
    buyer_name: order.buyer_name,
    amount: order.amount,
    currency: order.currency,
    product_type: order.product_type,
    product_name: order.product_name,
    last_attempt_at: new Date().toISOString(),
  };

  const { data: existingLog } = await supabase
    .from("nibo_sync_log")
    .select("id, attempts, nibo_customer_id, nibo_schedule_id, nibo_invoice_id, status")
    .eq("order_id", order.id)
    .maybeSingle();

  // Se já está success completo, retorna
  if (existingLog?.status === "success") {
    return { ok: true, skipped: true, log_id: existingLog.id };
  }

  const attempts = (existingLog?.attempts ?? 0) + 1;
  await supabase.from("nibo_sync_log").upsert(
    { ...baseLog, attempts, status: "pending" },
    { onConflict: "order_id" },
  );

  // 1) Cliente
  let customerId = existingLog?.nibo_customer_id ?? null;
  let customerStatus: "success" | "failed" | "skipped" = "skipped";
  let lastError: string | null = null;
  const responses: Record<string, unknown> = {};

  if (!customerId) {
    const c = await upsertCustomer(order);
    customerStatus = c.status;
    customerId = c.id;
    responses.customer = c.raw;
    if (c.error) lastError = c.error;
  } else {
    customerStatus = "success";
  }

  // 2) Schedule
  let scheduleId = existingLog?.nibo_schedule_id ?? null;
  let scheduleStatus: "success" | "failed" | "skipped" = "skipped";
  if (customerId && !scheduleId) {
    const s = await createSchedule(order, customerId);
    scheduleStatus = s.status;
    scheduleId = s.id;
    responses.schedule = s.raw;
    if (s.error) lastError = s.error;
  } else if (scheduleId) {
    scheduleStatus = "success";
  }

  // 3) Invoice (NF-e)
  let invoiceId = existingLog?.nibo_invoice_id ?? null;
  let invoiceStatus: "success" | "failed" | "skipped" = "skipped";
  if (customerId && !invoiceId) {
    const inv = await emitInvoice(order, customerId);
    invoiceStatus = inv.status;
    invoiceId = inv.id;
    responses.invoice = inv.raw;
    if (inv.error) lastError = inv.error;
  } else if (invoiceId) {
    invoiceStatus = "success";
  }

  const allOk =
    customerStatus === "success" &&
    scheduleStatus === "success" &&
    invoiceStatus === "success";
  const anyFail =
    customerStatus === "failed" ||
    scheduleStatus === "failed" ||
    invoiceStatus === "failed";

  const finalStatus = allOk ? "success" : anyFail ? "partial" : "pending";

  await supabase.from("nibo_sync_log").update({
    status: finalStatus,
    customer_status: customerStatus,
    schedule_status: scheduleStatus,
    invoice_status: invoiceStatus,
    nibo_customer_id: customerId,
    nibo_schedule_id: scheduleId,
    nibo_invoice_id: invoiceId,
    last_error: lastError,
    last_response: responses,
  }).eq("order_id", order.id);

  return {
    ok: allOk,
    status: finalStatus,
    customer_id: customerId,
    schedule_id: scheduleId,
    invoice_id: invoiceId,
    error: lastError,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    let orderIds: string[] = body.order_ids || (body.order_id ? [body.order_id] : []);

    // Modo automático (cron): processa últimas vendas sem sync com sucesso.
    // Consulta direta nas tabelas de acesso (bypassa admin_orders que exige is_admin via auth.uid).
    if (body.auto === true && orderIds.length === 0) {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const collected: string[] = [];

      const pulls = await Promise.all([
        supabase.from("user_courses").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("user_ebooks").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("user_combos").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("user_packages").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("vip_payments").select("id, paid_at, created_at")
          .eq("status", "paid").gte("created_at", since)
          .order("created_at", { ascending: false }).limit(200),
      ]);

      const [courses, ebooks, combos, packages, vips] = pulls.map((r) => r.data || []) as Array<Array<{ id: string }>>;
      for (const r of courses) collected.push(`course:${r.id}`);
      for (const r of ebooks) collected.push(`ebook:${r.id}`);
      for (const r of combos) collected.push(`combo:${r.id}`);
      for (const r of packages) collected.push(`package:${r.id}`);
      for (const r of vips) collected.push(`vip:${r.id}`);

      if (collected.length > 0) {
        const { data: synced } = await supabase
          .from("nibo_sync_log")
          .select("order_id, status")
          .in("order_id", collected);
        const okSet = new Set(
          (synced || []).filter((s) => s.status === "success").map((s) => s.order_id),
        );
        // Limita 50 por execução para não estourar tempo
        orderIds = collected.filter((id) => !okSet.has(id)).slice(0, 50);
      }
    }

    if (orderIds.length === 0) {
      return new Response(
        JSON.stringify({ results: [], message: "Nenhuma venda para sincronizar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = [];
    for (const id of orderIds) {
      try {
        results.push({ order_id: id, ...(await processOrder(id)) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("processOrder fail", id, msg);
        results.push({ order_id: id, ok: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
