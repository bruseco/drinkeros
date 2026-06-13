import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NIBO_TOKEN = Deno.env.get("NIBO_API_TOKEN") ?? "";

async function post(body: Record<string, unknown>) {
  const res = await fetch("https://api.nibo.com.br/empresas/v1/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", apitoken: NIBO_TOKEN },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text(), sent: body };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const rand = Math.random().toString(36).slice(2, 8);
  const results: Record<string, unknown> = {};
  const safeName = "Maycon douglas calado da silva";
  const email = `maycon+${rand}@example.com`;

  results.production_shape = await post({
    name: safeName,
    corporateName: safeName,
    email,
    isActive: true,
    communication: { contactName: safeName, email, cellPhone: "5582987602377" },
    document: { number: "12621946445", type: "Cpf" },
    phone: { number: "5582987602377" },
  });

  const searchRes = await fetch(
    `https://api.nibo.com.br/empresas/v1/customers?$filter=email eq '${encodeURIComponent(email)}'&$top=1`,
    { headers: { apitoken: NIBO_TOKEN, Accept: "application/json" } },
  );
  results.search_after = { status: searchRes.status, body: (await searchRes.text()).slice(0, 500) };

  // also test without phone/document — replicate broken case
  results.no_doc = await post({
    name: "Sem CPF Test",
    email: `nodoc+${rand}@example.com`,
    isActive: true,
    communication: { contactName: "Sem CPF Test", email: `nodoc+${rand}@example.com` },
  });

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
