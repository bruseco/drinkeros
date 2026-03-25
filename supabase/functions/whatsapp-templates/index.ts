import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      return handleGet(supabase, req);
    }

    if (req.method === "POST") {
      return handlePost(supabase, req);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-templates error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleGet(supabase: any, req: Request) {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connection_id");
  if (!connectionId) {
    return new Response(JSON.stringify({ error: "connection_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[whatsapp-templates] DB read error:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar templates do banco" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: data || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handlePost(supabase: any, req: Request) {
  const body = await req.json();
  const { action, connection_id, template, template_name } = body;

  if (!connection_id) {
    return new Response(JSON.stringify({ error: "connection_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "create") {
    const { token, apiUrl } = await getConnectionCredentials(supabase, connection_id);
    return handleCreate(supabase, connection_id, template, token, apiUrl);
  }

  if (action === "delete") {
    return handleDelete(supabase, connection_id, template_name);
  }

  if (action === "sync") {
    const { token, apiUrl } = await getConnectionCredentials(supabase, connection_id);
    return handleSync(supabase, connection_id, token, apiUrl);
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCreate(
  supabase: any,
  connectionId: string,
  template: any,
  token: string,
  apiUrl: string
) {
  // POST /v1/templates — sem waba_id como query param
  const createUrl = `${apiUrl}/v1/templates`;
  console.log(`[whatsapp-templates] POST create ${createUrl}`);
  console.log(`[whatsapp-templates] Request body:`, JSON.stringify(template));

  const graphRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      "X-API-Key": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(template),
  });
  const graphData = await graphRes.json();
  console.log(`[whatsapp-templates] POST create response status: ${graphRes.status}`);
  console.log(`[whatsapp-templates] POST create response body:`, JSON.stringify(graphData));

  const alreadyExists = graphRes.status === 409;

  if (!graphRes.ok && !alreadyExists) {
    return new Response(
      JSON.stringify({
        error: graphData.error?.message || graphData.message || "Era Cloud API error",
        details: graphData,
      }),
      { status: graphRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Save to local database (upsert)
  const { error: dbError } = await supabase
    .from("whatsapp_templates")
    .upsert(
      {
        connection_id: connectionId,
        name: template.name,
        language: template.language || "pt_BR",
        category: template.category,
        status: "PENDING",
        components: template.components,
      },
      { onConflict: "connection_id,name,language" }
    );

  if (dbError) {
    console.error("[whatsapp-templates] DB insert error:", dbError);
  }

  return new Response(
    JSON.stringify({ ...graphData, already_exists: alreadyExists }),
    { status: alreadyExists ? 200 : 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDelete(
  supabase: any,
  connectionId: string,
  templateName: string
) {
  // Delete apenas do banco local (Era Cloud não tem endpoint DELETE)
  if (!templateName) {
    return new Response(JSON.stringify({ error: "template_name is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[whatsapp-templates] DELETE local only: ${templateName}`);

  const { error: dbError } = await supabase
    .from("whatsapp_templates")
    .delete()
    .eq("connection_id", connectionId)
    .eq("name", templateName);

  if (dbError) {
    console.error("[whatsapp-templates] DB delete error:", dbError);
    return new Response(JSON.stringify({ error: "Erro ao excluir template do banco" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSync(
  supabase: any,
  connectionId: string,
  token: string,
  apiUrl: string
) {
  // 1. POST /v1/templates/sync — sincroniza Meta -> Era Cloud
  const syncUrl = `${apiUrl}/v1/templates/sync`;
  console.log(`[whatsapp-templates] POST sync ${syncUrl}`);

  const syncRes = await fetch(syncUrl, {
    method: "POST",
    headers: { "X-API-Key": token },
  });
  const syncData = await syncRes.json();
  console.log(`[whatsapp-templates] Sync response status: ${syncRes.status}`);
  console.log(`[whatsapp-templates] Sync response body:`, JSON.stringify(syncData));

  if (!syncRes.ok) {
    return new Response(
      JSON.stringify({
        error: syncData.error?.message || syncData.message || "Erro ao sincronizar templates",
        details: syncData,
      }),
      { status: syncRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. GET /v1/templates — busca templates atualizados
  const listUrl = `${apiUrl}/v1/templates`;
  console.log(`[whatsapp-templates] GET list ${listUrl}`);

  const listRes = await fetch(listUrl, {
    headers: { "X-API-Key": token },
  });
  const listData = await listRes.json();
  console.log(`[whatsapp-templates] List response status: ${listRes.status}`);
  console.log(`[whatsapp-templates] List response body:`, JSON.stringify(listData));

  if (!listRes.ok) {
    return new Response(
      JSON.stringify({
        error: listData.error?.message || listData.message || "Erro ao listar templates",
        details: listData,
      }),
      { status: listRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. Upsert templates no banco local
  const metaTemplates = listData.data || listData || [];
  let synced = 0;

  for (const t of metaTemplates) {
    const { error } = await supabase
      .from("whatsapp_templates")
      .upsert(
        {
          connection_id: connectionId,
          name: t.name,
          language: t.language || "pt_BR",
          category: t.category,
          status: t.status || "PENDING",
          components: t.components || [],
        },
        { onConflict: "connection_id,name,language" }
      );
    if (error) {
      console.error(`[whatsapp-templates] Sync upsert error for ${t.name}:`, error);
    } else {
      synced++;
    }
  }

  // 4. Remove local templates that no longer exist in Era Cloud
  const remoteNames = metaTemplates.map((t: any) => t.name);
  if (remoteNames.length > 0) {
    const { data: localTemplates } = await supabase
      .from("whatsapp_templates")
      .select("id, name")
      .eq("connection_id", connectionId);

    const orphans = (localTemplates || []).filter(
      (lt: any) => !remoteNames.includes(lt.name)
    );

    if (orphans.length > 0) {
      const orphanIds = orphans.map((o: any) => o.id);
      const { error: delError } = await supabase
        .from("whatsapp_templates")
        .delete()
        .in("id", orphanIds);

      if (delError) {
        console.error("[whatsapp-templates] Error removing orphan templates:", delError);
      } else {
        console.log(`[whatsapp-templates] Removed ${orphans.length} orphan templates: ${orphans.map((o: any) => o.name).join(", ")}`);
      }
    }
  }

  console.log(`[whatsapp-templates] Synced ${synced}/${metaTemplates.length} templates`);

  return new Response(
    JSON.stringify({ success: true, synced, total: metaTemplates.length, removed: metaTemplates.length > 0 ? (metaTemplates.length > 0 ? undefined : 0) : 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function getConnectionCredentials(
  supabase: any,
  connectionId: string
): Promise<{ token: string; apiUrl: string }> {
  const { data, error } = await supabase
    .from("zapi_connections")
    .select("token, api_url, provider")
    .eq("id", connectionId)
    .single();

  if (error || !data) throw new Error("Connection not found");
  if (data.provider !== "era_cloud") throw new Error("Connection is not an Era Cloud connection");
  if (!data.token) throw new Error("API Key not configured for this connection");
  if (!data.api_url) throw new Error("API URL not configured for this connection.");

  return { token: data.token, apiUrl: data.api_url };
}
