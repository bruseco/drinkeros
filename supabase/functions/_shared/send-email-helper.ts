import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Sends a transactional email by invoking the send-transactional-email Edge Function.
 * Used by other Edge Functions to replace direct SES calls.
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

  const { data, error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: params.templateName,
      recipientEmail: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      templateData: params.templateData,
    },
  });

  if (error) {
    console.error("Failed to send transactional email:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
