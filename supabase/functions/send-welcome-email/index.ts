import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WelcomeEmailRequest {
  email: string;
  fullName?: string;
  temporaryPassword: string;
  loginUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, temporaryPassword, loginUrl }: WelcomeEmailRequest = await req.json();

    if (!email || !temporaryPassword || !loginUrl) {
      throw new Error("Missing required fields: email, temporaryPassword, loginUrl");
    }

    const userName = fullName || email.split("@")[0];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Send via transactional email system
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "welcome",
        recipientEmail: email,
        idempotencyKey: `welcome-${email}-${Date.now()}`,
        templateData: {
          userName,
          email,
          password: temporaryPassword,
          loginUrl,
        },
      },
    });

    if (error) {
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }

    console.log("Welcome email sent successfully via transactional system:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

Deno.serve(handler);
