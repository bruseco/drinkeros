import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reset password emails are now handled natively by the auth-email-hook (recovery template).
// This function is kept for backward compatibility.

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!existingProfile) {
      console.log("Reset password requested for non-existent user:", email);
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, um link será enviado." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use native Supabase password reset (handled by auth-email-hook)
    const siteUrl = Deno.env.get("SITE_URL") || "https://criminallab.lovable.app";
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (resetError) {
      console.error("Error generating recovery link:", resetError.message);
    }

    console.log("Reset password triggered via native auth system for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Se o email existir, um link será enviado." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending reset password email:", error);
    return new Response(
      JSON.stringify({ success: true, message: "Se o email existir, um link será enviado." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
