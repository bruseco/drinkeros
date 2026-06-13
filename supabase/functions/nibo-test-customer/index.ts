import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const NIBO_TOKEN = Deno.env.get("NIBO_API_TOKEN") ?? "";
async function post(body: Record<string, unknown>) {
  const res = await fetch("https://api.nibo.com.br/empresas/v1/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json", apitoken: NIBO_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.text()).slice(0, 200) };
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const r = Math.random().toString(36).slice(2, 8);
  const base = { name: "Maycon Test", email: `m+${r}@example.com`, isActive: true };
  const out: Record<string, unknown> = {};
  out.A_base = await post({ ...base, email: `mA${r}@example.com` });
  out.B_corp = await post({ ...base, email: `mB${r}@example.com`, corporateName: "Maycon Test" });
  out.C_comm = await post({ ...base, email: `mC${r}@example.com`, communication: { contactName: "Maycon Test", email: `mC${r}@example.com`, cellPhone: "5582987602377" } });
  out.D_doc = await post({ ...base, email: `mD${r}@example.com`, document: { number: "12621946445", type: "Cpf" } });
  out.E_phone = await post({ ...base, email: `mE${r}@example.com`, phone: { number: "5582987602377" } });
  out.F_corp_doc = await post({ ...base, email: `mF${r}@example.com`, corporateName: "Maycon Test", document: { number: "12621946445", type: "Cpf" } });
  out.G_corp_phone = await post({ ...base, email: `mG${r}@example.com`, corporateName: "Maycon Test", phone: { number: "5582987602377" } });
  out.H_corp_comm = await post({ ...base, email: `mH${r}@example.com`, corporateName: "Maycon Test", communication: { contactName: "Maycon Test", email: `mH${r}@example.com`, cellPhone: "5582987602377" } });
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
