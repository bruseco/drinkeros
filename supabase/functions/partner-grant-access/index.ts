import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TABLE_BY_TYPE: Record<string, { table: string; col: string }> = {
  curso: { table: "user_courses", col: "course_id" },
  ebook: { table: "user_ebooks", col: "ebook_id" },
  combo: { table: "user_combos", col: "combo_id" },
  pacote: { table: "user_packages", col: "package_id" },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roleList = (roles || []).map((r: any) => r.role);
    const isPartner = roleList.includes("parceiro");
    const isSuperAdmin = roleList.includes("super_admin");
    if (!isPartner && !isSuperAdmin) return json({ error: "Permissão negada" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // Produtos vinculados ao parceiro
    const { data: partnerProducts } = await supabase
      .from("partner_products")
      .select("product_type, product_id, product_name")
      .eq("user_id", user.id);
    const products = (partnerProducts || []).filter((p: any) => p.product_id && TABLE_BY_TYPE[p.product_type]);

    if (action === "products") {
      return json({ products });
    }

    if (action === "search") {
      const q = String(body.query || "").trim().toLowerCase();
      if (q.length < 3) return json({ users: [] });
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .ilike("email", `%${q}%`)
        .limit(8);
      if (error) throw error;
      return json({ users: data || [] });
    }

    if (action === "grant") {
      const targetUserId = String(body.target_user_id || "");
      const productType = String(body.product_type || "");
      const productId = String(body.product_id || "");
      if (!targetUserId || !productType || !productId) {
        return json({ error: "Dados incompletos" }, 400);
      }
      const allowed = products.find(
        (p: any) => p.product_type === productType && p.product_id === productId,
      );
      if (!allowed) return json({ error: "Produto não vinculado ao parceiro" }, 403);

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, email")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!profile) return json({ error: "E-mail não cadastrado na base" }, 404);

      const { table, col } = TABLE_BY_TYPE[productType];
      const { data: existing } = await supabase
        .from(table)
        .select("id")
        .eq("user_id", targetUserId)
        .eq(col, productId)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabase
          .from(table)
          .insert({ user_id: targetUserId, [col]: productId });
        if (insErr) return json({ error: insErr.message }, 400);
      }

      await supabase.from("partner_access_grants").insert({
        partner_user_id: user.id,
        target_user_id: targetUserId,
        target_email: profile.email,
        product_type: productType,
        product_id: productId,
        product_name: allowed.product_name,
      });

      return json({ success: true, already_had: !!existing });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Erro inesperado" }, 500);
  }
});
