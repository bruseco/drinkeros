import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function record(
  event: any,
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  logStatus: 'bounced' | 'complained' | 'suppressed',
  description: string,
) {
  const email = String(event?.data?.recipient || '').toLowerCase()
  if (!email) {
    console.warn('Email event without recipient', { event_id: event.event_id })
    return
  }

  const { error: supErr } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (supErr) {
    console.error('suppressed_emails write failed', {
      code: supErr.code,
      message: supErr.message,
      event_id: event.event_id,
    })
    throw new Error('suppressed_emails write failed')
  }

  const { error: logErr } = await supabase.from('email_send_log').insert({
    template_name: 'system',
    recipient_email: email,
    status: logStatus,
    error_message: description,
  })
  if (logErr) {
    console.error('email_send_log write failed', {
      code: logErr.code,
      message: logErr.message,
      event_id: event.event_id,
    })
    throw new Error('email_send_log write failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event, 'bounce', 'bounced', 'E-mail retornou (bounce)')
    },
    'email.complaint': async (event) => {
      await record(event, 'complaint', 'complained', 'Marcado como spam pelo destinatário')
    },
    'email.unsubscribed': async (event) => {
      await record(event, 'unsubscribe', 'suppressed', 'Descadastrado pelo destinatário')
    },
  },
})

Deno.serve((req) => handler(req))
