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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, password } = await req.json();

    // Step 1: Check if email exists
    if (action === "check") {
      if (!email) {
        return new Response(JSON.stringify({ exists: false, error: "E-mail obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("email", normalizedEmail)
        .limit(1);

      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ exists: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ exists: true, userId: profiles[0].user_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: set_password is permanently disabled.
    // Previously this allowed setting a new password with only an email —
    // effectively an account takeover. The legacy migration is complete;
    // users must use the standard "esqueci minha senha" reset flow (magic
    // link / OTP verified server-side) to change their password.
    if (action === "set_password") {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Esta rota foi desativada. Use 'Esqueci minha senha' para redefinir sua senha por e-mail.",
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Legacy stub kept to preserve function signature — unreachable.
    if (false && action === "set_password_disabled") {
      if (!email || !password) {
        return new Response(JSON.stringify({ success: false, error: "E-mail e senha são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (password.length < 6) {
        return new Response(JSON.stringify({ success: false, error: "A senha deve ter no mínimo 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Find user
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("email", normalizedEmail)
        .limit(1);

      if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = profiles[0].user_id;

      // Update password via admin API
      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });

      if (error) {
        console.error("Error setting password:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
