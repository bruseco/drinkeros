// Returns the latest unsent paid purchase for the authenticated user
// and marks it as `meta_purchase_sent = true`, so the frontend can fire
// a single Meta Pixel `Purchase` event with the REAL transaction data.
//
// Idempotent: if the purchase was already sent, returns { purchase: null }.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Optional: only consider purchases from the last 24h to avoid firing for old data
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: purchase, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .eq("meta_purchase_sent", false)
      .in("status", ["paid", "approved", "active"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!purchase) {
      return new Response(JSON.stringify({ purchase: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic mark-as-sent: only update if still false
    const { data: updated, error: updErr } = await supabase
      .from("purchases")
      .update({ meta_purchase_sent: true, meta_purchase_sent_at: new Date().toISOString() })
      .eq("id", purchase.id)
      .eq("meta_purchase_sent", false)
      .select("id")
      .maybeSingle();

    if (updErr) throw updErr;
    if (!updated) {
      // Lost the race; another tab/call already fired it
      return new Response(JSON.stringify({ purchase: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        purchase: {
          transaction_id: purchase.transaction_id,
          amount_paid: Number(purchase.amount_paid),
          currency: purchase.currency || "BRL",
          product_name: purchase.product_name,
          product_type: purchase.product_type,
          product_id: purchase.product_id,
          gateway: purchase.gateway,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[confirm-purchase]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
