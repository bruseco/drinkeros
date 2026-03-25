import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses@3.485.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sesClient = new SESClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

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

// Default fallback template
const DEFAULT_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0a; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; color: #f5f5f5;">
    <h1>Bem-vindo(a), {{user_name}}!</h1>
    <p>Email: {{email}}</p>
    <p>Senha temporária: {{password}}</p>
    <a href="{{login_url}}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">Acessar minha conta</a>
  </div>
</body></html>`;

async function sendEmailViaSES(params: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const command = new SendEmailCommand({
    Source: params.from,
    Destination: { ToAddresses: params.to },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: { Html: { Data: params.html, Charset: "UTF-8" } },
    },
    ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
    Tags: [
      { Name: "email_type", Value: "transactional" },
    ],
  });
  return sesClient.send(command);
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

    // Create supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch email settings and template from DB
    const [settingsResult, templateResult] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "welcome").single(),
    ]);

    // Use DB values or fallback
    const senderName = settingsResult.data?.sender_name || "Criminal Lab";
    const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = settingsResult.data?.reply_to_email || undefined;
    const subject = templateResult.data?.subject || "Bem-vindo! Seu acesso está pronto";
    let htmlBody = templateResult.data?.html_body || DEFAULT_HTML;

    // Replace variables
    htmlBody = htmlBody
      .replaceAll("{{user_name}}", userName)
      .replaceAll("{{email}}", email)
      .replaceAll("{{password}}", temporaryPassword)
      .replaceAll("{{login_url}}", loginUrl);

    const emailResponse = await sendEmailViaSES({
      from: `${senderName} <${senderEmail}>`,
      to: [email],
      subject,
      html: htmlBody,
      replyTo,
    });

    console.log("Welcome email sent successfully via SES:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
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

serve(handler);
