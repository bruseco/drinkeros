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

interface ResetPasswordRequest {
  email: string;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0a; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; color: #f5f5f5;">
    <h1>Redefinição de Senha</h1>
    <p>Olá, {{user_name}}!</p>
    <p>Clique no botão abaixo para redefinir sua senha:</p>
    <a href="{{reset_url}}" style="background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;">Redefinir minha senha</a>
    <p style="color:#a3a3a3;font-size:13px;margin-top:24px;">Se você não solicitou essa alteração, ignore este email.</p>
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
    const { email }: ResetPasswordRequest = await req.json();

    if (!email) {
      throw new Error("Email é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists before generating link
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

    // Generate recovery link using admin API
    const siteUrl = Deno.env.get("SITE_URL") || "https://criminallab.lovable.app";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError.message);
      return new Response(
        JSON.stringify({ success: true, message: "Se o email existir, um link será enviado." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recoveryLink = linkData?.properties?.action_link;
    if (!recoveryLink) {
      throw new Error("Failed to generate recovery link");
    }

    // Get user name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", email)
      .single();

    const userName = profile?.full_name || email.split("@")[0];

    // Fetch email settings and template from DB
    const [settingsResult, templateResult] = await Promise.all([
      supabase.from("email_settings").select("*").limit(1).single(),
      supabase.from("email_templates").select("*").eq("slug", "reset-password").single(),
    ]);

    const senderName = settingsResult.data?.sender_name || "Criminal Lab";
    const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
    const replyTo = settingsResult.data?.reply_to_email || undefined;
    const subject = templateResult.data?.subject || "Redefina sua senha - Criminal Lab";
    let htmlBody = templateResult.data?.html_body || DEFAULT_HTML;

    // Replace variables
    htmlBody = htmlBody
      .replaceAll("{{user_name}}", userName)
      .replaceAll("{{email}}", email)
      .replaceAll("{{reset_url}}", recoveryLink);

    await sendEmailViaSES({
      from: `${senderName} <${senderEmail}>`,
      to: [email],
      subject,
      html: htmlBody,
      replyTo,
    });

    console.log("Reset password email sent successfully via SES");

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

serve(handler);
