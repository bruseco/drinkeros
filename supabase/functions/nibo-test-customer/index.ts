// Quick diagnostic: tries different payloads against NIBO /customers and returns the error messages.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NIBO_TOKEN = Deno.env.get("NIBO_API_TOKEN") ?? "";

async function post(body: Record<string, unknown>) {
  const res = await fetch("https://api.nibo.com.br/empresas/v1/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      apitoken: NIBO_TOKEN,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const rand = Math.random().toString(36).slice(2, 8);
  const results: Record<string, unknown> = {};

  results.minimal = await post({ name: `Test ${rand}-1`, email: `t${rand}1@example.com` });
  results.with_clientType = await post({ name: `Test ${rand}-2`, email: `t${rand}2@example.com`, clientType: "Person" });
  results.with_doc_cpf = await post({ name: `Test ${rand}-3`, email: `t${rand}3@example.com`, document: { number: "12621946445", type: "Cpf" } });
  results.full = await post({
    name: `Test ${rand}-4`,
    email: `t${rand}4@example.com`,
    clientType: "Person",
    document: { number: "12621946445", type: "Cpf" },
    communication: { contactName: `Test ${rand}-4`, email: `t${rand}4@example.com` },
  });

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
