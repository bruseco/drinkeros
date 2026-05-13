// Lista perfis de serviço configurados na conta NIBO. Apenas admin.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NIBO_BASE = "https://api.nibo.com.br/empresas/v1";
const NIBO_TOKEN = Deno.env.get("NIBO_API_TOKEN") ?? "";

async function nibo<T = any>(path: string): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const res = await fetch(`${NIBO_BASE}${path}`, {
    headers: { apitoken: NIBO_TOKEN, Accept: "application/json" },
  });
  const raw = await res.text();
  let data: T | null = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
  return { ok: res.ok, status: res.status, data, raw };
}

function normalize(item: any) {
  // NIBO usa nomes diferentes em endpoints distintos. Cobre os mais comuns.
  return {
    id: item.id ?? item.serviceId ?? item.productId ?? null,
    name: item.name ?? item.description ?? item.serviceName ?? null,
    cnae: item.cnae ?? item.cnaeCode ?? item.cnae_code ?? null,
    lc116: item.lc116 ?? item.serviceCodeLC116 ?? item.serviceCode ?? null,
    municipal_code: item.municipalCode ?? item.cityServiceCode ?? item.municipal_code ?? null,
    iss_rate: item.issRate ?? item.iss ?? item.aliquotaIss ?? null,
    raw: item,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!NIBO_TOKEN) throw new Error("NIBO_API_TOKEN não configurado");

    // Verifica admin
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Não autenticado");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: u } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!u?.user) throw new Error("Não autenticado");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: isAdm } = await admin.rpc("is_admin", { _user_id: u.user.id });
    if (!isAdm) throw new Error("Forbidden");

    // Tenta múltiplos endpoints conhecidos do NIBO (variações de path/casing)
    const candidates = [
      // Sanity-check (deve responder com a empresa logada)
      "/organizations",
      "/companies",
      // Possíveis nomes para perfis de serviço fiscais
      "/services",
      "/Services",
      "/serviceitems",
      "/serviceItems",
      "/ServiceItems",
      "/service-items",
      "/products",
      "/products?$filter=type eq 'Service'",
      "/products?$filter=isService eq true",
      "/items",
      "/fiscal/services",
      "/invoices/serviceinvoices/services",
      "/invoices/services",
    ];

    const attempts: Array<{ path: string; status: number; ok: boolean; sample: string }> = [];
    let services: any[] = [];
    let usedPath: string | null = null;

    const SANITY = new Set(["/organizations", "/companies"]);
    for (const p of candidates) {
      const r = await nibo<any>(p);
      attempts.push({ path: p, status: r.status, ok: r.ok, sample: r.raw.slice(0, 200) });
      if (SANITY.has(p)) continue; // só diagnóstico de conectividade
      if (!r.ok || !r.data) continue;
      const items: any[] = Array.isArray(r.data?.items)
        ? r.data.items
        : Array.isArray(r.data)
        ? (r.data as any[])
        : [];
      if (items.length === 0) continue;
      services = items.map(normalize);
      usedPath = p;
      break;
    }

    return new Response(
      JSON.stringify({ ok: true, used_path: usedPath, count: services.length, services, attempts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
