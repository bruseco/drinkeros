import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sends an email by enqueuing it to the transactional email queue via RPC.
 * This is for server-side Edge Functions that need to send emails without SES.
 * Uses the same queue infrastructure as send-transactional-email.
 */
export async function enqueueEmail(
  supabase: any,
  params: {
    to: string;
    subject: string;
    html: string;
    label?: string;
    idempotencyKey?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const messageId = crypto.randomUUID();
  const SENDER_DOMAIN = "notify.drinkeros.com";
  const FROM_DOMAIN = "notify.drinkeros.com";
  const SITE_NAME = "Drinkeros";

  try {
    // Log pending
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: params.label || "direct",
      recipient_email: params.to,
      status: "pending",
    });

    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: params.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: params.subject,
        html: params.html,
        text: "",
        purpose: "transactional",
        label: params.label || "direct",
        idempotency_key: params.idempotencyKey || messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue email:", enqueueError);
      return { success: false, error: enqueueError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("enqueueEmail error:", err);
    return { success: false, error: err.message };
  }
}
