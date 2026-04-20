import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { sql } = await req.json();
    if (!sql) throw new Error("missing sql");

    // Use raw HTTP to PostgREST RPC won't work for arbitrary SQL.
    // Instead use a fetch to pg via the SQL endpoint? Not available.
    // We'll execute by creating a temporary RPC via PG.
    // Workaround: use postgres-js
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const client = new Client(dbUrl);
    await client.connect();
    try {
      const result = await client.queryObject(sql);
      return new Response(JSON.stringify({ ok: true, rows: result.rows, rowCount: result.rowCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await client.end();
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
