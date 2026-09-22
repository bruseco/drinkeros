import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTemplateEmail } from "./transactional-email-templates/send-email.ts";

/**
 * Envia um e-mail transacional através do serviço gerenciado de e-mail da Lovable.
 * Mantém o registro em email_send_log (histórico do app).
 */
export async function sendTransactionalEmail(params: {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  return await sendTemplateEmailWithLog(supabase, params);
}

/**
 * Mesma função, reaproveitando um client Supabase já existente.
 */
export async function sendTemplateEmailWithLog(
  supabase: any,
  params: {
    templateName: string;
    recipientEmail: string;
    idempotencyKey: string;
    templateData?: Record<string, any>;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sendTemplateEmail(params.templateName, params.recipientEmail, {
      templateData: params.templateData,
      idempotencyKey: params.idempotencyKey,
    });

    if (!result.sent) {
      await logSend(supabase, params.templateName, params.recipientEmail, "suppressed");
      console.log("Email suppressed", { template: params.templateName });
      return { success: false, error: "recipient_suppressed" };
    }

    await logSend(supabase, params.templateName, params.recipientEmail, "sent");
    return { success: true };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send transactional email:", message);
    await logSend(supabase, params.templateName, params.recipientEmail, "failed", message);
    return { success: false, error: message };
  }
}

async function logSend(
  supabase: any,
  templateName: string,
  recipientEmail: string,
  status: "sent" | "suppressed" | "failed",
  errorMessage?: string,
) {
  const { error } = await supabase.from("email_send_log").insert({
    message_id: null,
    template_name: templateName,
    recipient_email: recipientEmail,
    status,
    error_message: errorMessage ? errorMessage.slice(0, 1000) : null,
  });
  if (error) {
    console.error("Failed to write email_send_log", { code: error.code, message: error.message });
  }
}
