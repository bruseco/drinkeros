import { EmailAPIError, sendLovableEmail } from "npm:@lovable.dev/email-js@0.1.0";

const SENDER_DOMAIN = "notify.drinkeros.com";
const FROM_DOMAIN = "notify.drinkeros.com";
const SITE_NAME = "Drinkeros";

/**
 * Envia um e-mail com HTML montado na hora (conteúdo dinâmico gerado pelo app)
 * através do serviço gerenciado de e-mail da Lovable, registrando o resultado
 * em email_send_log.
 */
export async function enqueueEmail(
  supabase: any,
  params: {
    to: string;
    subject: string;
    html: string;
    label?: string;
    idempotencyKey?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const templateName = params.label || "direct";

  if (!apiKey) {
    console.error("LOVABLE_API_KEY is not configured");
    await logSend(supabase, templateName, params.to, "failed", "LOVABLE_API_KEY is not configured");
    return { success: false, error: "LOVABLE_API_KEY is not configured" };
  }

  try {
    await sendLovableEmail(
      {
        to: params.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: params.subject,
        html: params.html,
        text: "",
        purpose: "transactional",
        label: templateName,
        idempotency_key: params.idempotencyKey || crypto.randomUUID(),
      },
      { apiKey, sendUrl: Deno.env.get("LOVABLE_SEND_URL") },
    );

    await logSend(supabase, templateName, params.to, "sent");
    return { success: true };
  } catch (err: any) {
    if (err instanceof EmailAPIError && err.code === "recipient_suppressed") {
      await logSend(supabase, templateName, params.to, "suppressed");
      return { success: false, error: "recipient_suppressed" };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("sendEmail error:", message);
    await logSend(supabase, templateName, params.to, "failed", message);
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
