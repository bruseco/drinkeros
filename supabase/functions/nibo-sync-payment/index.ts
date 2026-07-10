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
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function canRunManualSync(req: Request): Promise<boolean> {
  if ((req.headers.get("x-internal-nibo-sync") || "") === SERVICE_KEY) return true;
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token && token === SERVICE_KEY) return true;
  if (!token || !ANON_KEY) return false;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: userData } = await userClient.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return false;

  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
  return isAdmin === true;
}

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

// NIBO retorna IDs como string JSON pura (ex.: "\"<uuid>\"") em vez de { id }.
function extractId(data: unknown, raw: string): string | null {
  if (typeof data === "string") return data;
  if (data && typeof (data as { id?: string }).id === "string") return (data as { id: string }).id;
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  if (/^[0-9a-f-]{30,}$/i.test(trimmed)) return trimmed;
  return null;
}

let cachedRevenueCategory: { id: string; name: string | null } | null | undefined;

function flattenCategories(items: unknown[]): Array<{ id: string; name: string | null; type: string | null; isDeleted: boolean; isSubgroup: boolean }> {
  const out: Array<{ id: string; name: string | null; type: string | null; isDeleted: boolean; isSubgroup: boolean }> = [];
  const visit = (item: Record<string, unknown>) => {
    const id = typeof item.id === "string" ? item.id : null;
    const children = Array.isArray(item.children) ? item.children : [];
    if (id && (typeof item.type === "string" || children.length === 0)) {
      out.push({
        id,
        name: typeof item.name === "string" ? item.name : null,
        type: typeof item.type === "string" ? item.type : null,
        isDeleted: item.isDeleted === true,
        isSubgroup: item.isSubgroup === true || item.isSubgroup === 1,
      });
    }
    for (const child of children) visit(child as Record<string, unknown>);
  };
  for (const item of items) visit(item as Record<string, unknown>);
  return out;
}

async function getRevenueCategory(): Promise<{ id: string; name: string | null } | null> {
  if (cachedRevenueCategory !== undefined) return cachedRevenueCategory;
  const attempts = await Promise.all([
    nibo<{ items?: unknown[] } | unknown[]>("/schedules/categories/tree?CanComposeNFSeValueOnly=true", { method: "GET" }),
    nibo<{ items?: unknown[] }>("/categories?$top=200", { method: "GET" }),
  ]);
  const categories = attempts.flatMap((r) => {
    const rawItems = Array.isArray(r.data) ? r.data : (Array.isArray((r.data as { items?: unknown[] } | null)?.items) ? (r.data as { items: unknown[] }).items : []);
    return flattenCategories(rawItems);
  }).filter((c) => c.id && !c.isDeleted && !c.isSubgroup);

  // 1) Preferência explícita: "101 - Infoprodutos e Cursos" (Drinkeros)
  const preferred =
    categories.find((c) => /^\s*101\b/.test(c.name || "") && /infoproduto|curso/i.test(c.name || "")) ||
    categories.find((c) => /infoproduto/i.test(c.name || "") && /curso/i.test(c.name || "")) ||
    categories.find((c) => /^\s*101\b/.test(c.name || "")) ||
    categories.find((c) => {
      const text = `${c.name || ""} ${c.type || ""}`.toLowerCase();
      return /receita|venda|servi[cç]o|faturamento|entrada|credit/.test(text);
    }) ||
    categories[0] ||
    null;
  cachedRevenueCategory = preferred ? { id: preferred.id, name: preferred.name } : null;
  return cachedRevenueCategory;
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
  hasCpf: boolean;
  error?: string;
  raw?: unknown;
}> {

  if (!order.buyer_email) {
    return { id: null, status: "failed", error: "Comprador sem e-mail" };
  }

  // Busca CPF + endereço do profile (NIBO precisa de tudo para emitir NF-e)
  let cpf: string | null = null;
  let addr: {
    cep: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  } = { cep: null, street: null, number: null, complement: null, neighborhood: null, city: null, state: null };
  if (order.user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("cpf, cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state")
      .eq("user_id", order.user_id)
      .maybeSingle();
    cpf = prof?.cpf?.replace(/\D/g, "") || null;
    if (prof) {
      addr = {
        cep: prof.cep?.replace(/\D/g, "") || null,
        street: prof.address_street?.trim() || null,
        number: prof.address_number?.trim() || null,
        complement: prof.address_complement?.trim() || null,
        neighborhood: prof.address_neighborhood?.trim() || null,
        city: prof.address_city?.trim() || null,
        state: prof.address_state?.trim()?.toUpperCase().slice(0, 2) || null,
      };
    }
  }

  // Tenta achar cliente existente por e-mail
  const search = await nibo<{ items?: Array<{ id: string }> }>(
    `/customers?$filter=email eq '${encodeURIComponent(order.buyer_email)}'&$top=1`,
    { method: "GET" },
  );
  const existingId = search.ok && search.data?.items?.[0]?.id ? search.data.items[0].id : null;

  // Cria
  const safeName = (order.buyer_name && order.buyer_name.trim())
    || order.buyer_email.split("@")[0].replace(/[._-]+/g, " ").trim()
    || order.buyer_email;
  const phoneDigits = order.buyer_phone ? order.buyer_phone.replace(/\D/g, "") : null;
  const baseBody: Record<string, unknown> = {
    name: safeName,
    corporateName: safeName,
    email: order.buyer_email,
    isActive: true,
    communication: {
      contactName: safeName,
      email: order.buyer_email,
      ...(phoneDigits ? { cellPhone: phoneDigits } : {}),
    },
  };
  if (cpf && cpf.length === 11) {
    baseBody.document = { number: cpf, type: "Cpf" };
  } else if (cpf && cpf.length === 14) {
    baseBody.document = { number: cpf, type: "Cnpj" };
  }

  // Endereço FLAT (city/state como strings) — NIBO rejeita o objeto aninhado
  // com a mensagem genérica "É necessário preencher os dados do cliente!".
  const addressFlat: Record<string, unknown> = {};
  if (addr.street) addressFlat.line1 = addr.street;
  if (addr.number) addressFlat.number = addr.number;
  if (addr.complement) addressFlat.line2 = addr.complement;
  if (addr.neighborhood) addressFlat.neighborhood = addr.neighborhood;
  if (addr.city) addressFlat.city = addr.city;
  if (addr.state) addressFlat.state = addr.state;
  if (addr.cep) addressFlat.zipCode = addr.cep;

  const fullBody = Object.keys(addressFlat).length > 0
    ? { ...baseBody, address: addressFlat }
    : baseBody;

  // Se já existe, atualiza com CPF/endereço (necessário para NF-e)
  if (existingId) {
    const upd = await nibo<unknown>(`/customers/${existingId}`, {
      method: "PUT",
      body: JSON.stringify(fullBody),
    });
    if (!upd.ok && Object.keys(addressFlat).length > 0) {
      await nibo<unknown>(`/customers/${existingId}`, {
        method: "PUT",
        body: JSON.stringify(baseBody),
      });
    }
    return { id: existingId, status: "success", raw: upd.data ?? search.data };
  }

  // POST: primeiro tenta com endereço; se falhar (NIBO 400 com address inválido),
  // recria sem endereço e atualiza depois via PUT.
  let created = await nibo<unknown>("/customers", {
    method: "POST",
    body: JSON.stringify(fullBody),
  });
  if (!created.ok && Object.keys(addressFlat).length > 0) {
    console.warn(`[nibo] POST /customers falhou com address (${created.status}). Retry sem address.`);
    created = await nibo<unknown>("/customers", {
      method: "POST",
      body: JSON.stringify(baseBody),
    });
  }
  const customerId = created.ok ? extractId(created.data, created.raw) : null;
  if (!customerId) {
    return {
      id: null,
      status: "failed",
      error: `customers POST ${created.status}: ${created.raw.slice(0, 400)}`,
    };
  }
  // Se temos endereço, tenta PUT para completar (não bloqueia se falhar)
  if (Object.keys(addressFlat).length > 0) {
    await nibo<unknown>(`/customers/${customerId}`, {
      method: "PUT",
      body: JSON.stringify(fullBody),
    }).catch(() => null);
  }
  return { id: customerId, status: "success", raw: created.data ?? created.raw };
}


async function createSchedule(order: OrderRow, customerId: string) {
  const dueDate = order.purchased_at.slice(0, 10);
  const mapping = await getServiceIdForType(order.product_type);
  if (!mapping.id) {
    return {
      id: null,
      status: "failed" as const,
      error: `Sem mapeamento NIBO para product_type="${order.product_type}". Configure em /admin/nibo.`,
      raw: null,
    };
  }
  const category = await getRevenueCategory();
  if (!category?.id) {
    return {
      id: null,
      status: "failed" as const,
      error: "Nenhuma categoria NIBO de receita/NFS-e encontrada para compor o recebimento.",
      raw: null,
    };
  }
  const body = {
    stakeholderId: customerId,
    dueDate,
    scheduleDate: dueDate,
    accrualDate: dueDate,
    categories: [{
      categoryId: category.id,
      value: Number(order.amount || 0),
      description: order.product_name,
    }],
    value: Number(order.amount || 0),
    description: `${order.product_name} (#${order.id})`,
    reference: order.external_ref || order.id,
    serviceProfileId: mapping.id,
    additionalServiceDescription: order.product_name,
  };
  // FormatType=json faz a NIBO retornar scheduleId; sem isso a resposta pode ser só string/HTML.
  const r = await nibo<unknown>("/schedules/credit/FormatType=json", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const id = r.ok
    ? ((r.data && typeof (r.data as { scheduleId?: string }).scheduleId === "string")
      ? (r.data as { scheduleId: string }).scheduleId
      : extractId(r.data, r.raw))
    : null;
  return {
    id,
    status: (r.ok && id) ? ("success" as const) : ("failed" as const),
    error: (r.ok && id) ? undefined : `schedules POST ${r.status}: ${r.raw.slice(0, 400)}`,
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

async function emitInvoice(order: OrderRow, customerId: string, scheduleId: string) {
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
    ScheduleId: scheduleId,
    StakeholderId: customerId,
    ServiceProfileId: mapping.id,
    AccrualRpsDate: order.purchased_at.slice(0, 10),
    AdditionalServiceDescription: order.product_name,
    AdditionalRemarks: `Pedido ${order.external_ref || order.id}`,
  };
  const r = await nibo<unknown>("/nfse", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const id = r.ok ? (extractId(r.data, r.raw) || `nfse:${order.id}`) : null;
  return {
    id,
    status: (r.ok && id) ? ("success" as const) : ("failed" as const),
    error: (r.ok && id) ? undefined : `nfse POST ${r.status}: ${r.raw.slice(0, 400)}`,
    raw: r.data ?? r.raw,
  };
}

async function processOrder(orderId: string) {
  if (!NIBO_TOKEN) {
    return { ok: false, error: "NIBO_API_TOKEN não configurado" };
  }
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: `Pedido ${orderId} não encontrado` };
  if (!(Number(order.amount || 0) > 0)) {
    return { ok: true, skipped: true, reason: "Pedido sem valor pago" };
  }

  // CLAIM ATÔMICO — impede que duas execuções concorrentes (webhook + cron)
  // criem o mesmo lançamento/NF duplicado no NIBO.
  const { data: claimed, error: claimErr } = await supabase.rpc("nibo_claim_order", {
    p_order_id: order.id,
    p_user_id: order.user_id,
    p_buyer_email: order.buyer_email,
    p_buyer_name: order.buyer_name,
    p_amount: order.amount,
    p_currency: order.currency,
    p_product_type: order.product_type,
    p_product_name: order.product_name,
  });
  if (claimErr) {
    console.error("nibo_claim_order error", claimErr);
    return { ok: false, error: `claim error: ${claimErr.message}` };
  }
  if (claimed !== true) {
    return { ok: true, skipped: true, reason: "Pedido já sincronizado ou em processamento" };
  }

  // Recarrega estado parcial (caso seja um retry após falha)
  const { data: existingLog } = await supabase
    .from("nibo_sync_log")
    .select("id, attempts, nibo_customer_id, nibo_schedule_id, nibo_invoice_id, status")
    .eq("order_id", order.id)
    .maybeSingle();


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
  if (customerId && scheduleId && !invoiceId) {
    const inv = await emitInvoice(order, customerId, scheduleId);
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

    if (orderIds.length > 0 && !(await canRunManualSync(req))) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo automático (cron): processa últimas vendas sem sync com sucesso.
    // Consulta direta nas tabelas de acesso (bypassa admin_orders que exige is_admin via auth.uid).
    if (body.auto === true && orderIds.length === 0) {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const collected: string[] = [];

      const pulls = await Promise.all([
        supabase.from("user_courses").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since).gt("amount", 0)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("user_ebooks").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since).gt("amount", 0)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("user_combos").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since).gt("amount", 0)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("user_packages").select("id, purchased_at")
          .in("source", ["stripe", "mercadopago"]).gte("purchased_at", since).gt("amount", 0)
          .order("purchased_at", { ascending: false }).limit(200),
        supabase.from("vip_payments").select("id, paid_at, created_at")
          .eq("status", "paid").gte("created_at", since).gt("amount", 0)
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
