import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Magic link emails are now handled natively by the auth-email-hook.
// This function is kept for backward compatibility but delegates to the native system.

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists in profiles (case-insensitive)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (!existingProfile) {
      console.log("Magic link requested for non-existent user:", email);
      return new Response(
        JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá um link de acesso." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the native Supabase magic link (handled by auth-email-hook)
    const siteUrl = Deno.env.get("SITE_URL") || "https://drinkeros.com";
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl}/login`,
      },
    });

    if (otpError) {
      console.error("Error generating magic link:", email, (otpError as any).status, otpError.message);
    }

    console.log("Magic link triggered via native auth system for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Link de acesso enviado com sucesso." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending magic link email:", error);
    return new Response(
      JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá um link de acesso." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
