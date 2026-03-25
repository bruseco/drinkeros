import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.190.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOKEN_EXPIRY_SECONDS = 300; // 5 minutes

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, ts, token } = await req.json();

    if (!email || !ts || !token) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: email, ts, token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Init Supabase client early for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const logSso = async (status: string, statusDetail: string) => {
      try {
        await supabase.from("webhook_logs").insert({
          source: "sso_wordpress",
          email,
          is_new_user: false,
          status,
          status_detail: statusDetail,
        });
      } catch (e) {
        console.warn("Failed to insert SSO log:", e);
      }
    };

    // Check timestamp expiry
    const now = Math.floor(Date.now() / 1000);
    const timestamp = parseInt(ts, 10);
    if (isNaN(timestamp) || Math.abs(now - timestamp) > TOKEN_EXPIRY_SECONDS) {
      await logSso("error", "Link SSO expirado");
      return new Response(
        JSON.stringify({ error: "Link expirado. Tente novamente pelo WordPress." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify HMAC
    const secret = Deno.env.get("SSO_SHARED_SECRET");
    if (!secret) {
      console.error("SSO_SHARED_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Erro de configuração do servidor" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(email + ts));
    const expectedToken = new TextDecoder().decode(hexEncode(new Uint8Array(signature)));

    if (token !== expectedToken) {
      await logSso("error", "Token SSO inválido");
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user exists in profiles before generating magic link
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (!profile) {
      await logSso("error", "Usuário não cadastrado na plataforma");
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado na plataforma. O acesso deve ser concedido pelo administrador." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate magic link
    const siteUrl = Deno.env.get("SITE_URL") || "https://criminallab.lovable.app";
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${siteUrl}/app`,
      },
    });

    if (error) {
      console.error("Error generating magic link:", error.message);
      await logSso("error", `Falha ao gerar magic link: ${error.message}`);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado ou erro ao gerar link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar link de autenticação" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await logSso("success", "Login SSO via WordPress");

    return new Response(
      JSON.stringify({ action_link: actionLink }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("SSO verify error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
