import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefundRequest {
  // Either a vip_payments record or a user_courses/user_combos/user_ebooks/user_packages record
  table: 'vip_payments' | 'user_courses' | 'user_combos' | 'user_ebooks' | 'user_packages';
  recordId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: require admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autenticado');
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Não autenticado');

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'editor'])
      .maybeSingle();
    if (!roleRow) throw new Error('Acesso negado');

    const body: RefundRequest = await req.json();
    const { table, recordId } = body;
    if (!table || !recordId) throw new Error('Parâmetros inválidos');

    // Fetch record
    const { data: record, error: fetchErr } = await (supabase as any)
      .from(table)
      .select('*')
      .eq('id', recordId)
      .maybeSingle();
    if (fetchErr || !record) throw new Error('Registro não encontrado');

    if (record.refunded_at) {
      throw new Error('Este pagamento já foi estornado');
    }

    // Determine provider + transaction id + amount
    let provider: 'stripe' | 'mercadopago' | 'manual' = 'manual';
    let stripeRef: string | null = null;
    let mpRef: string | null = null;
    let amount: number = Number(record.amount || 0);

    if (table === 'vip_payments') {
      stripeRef = record.stripe_payment_intent_id || record.stripe_charge_id;
      mpRef = record.metadata?.mercadopago_payment_id ?? null;
      if (record.metadata?.source === 'mercadopago' || mpRef) provider = 'mercadopago';
      else if (stripeRef) provider = 'stripe';
    } else {
      stripeRef = record.stripe_payment_intent_id;
      mpRef = record.mercadopago_payment_id;
      if (record.source === 'mercadopago' || mpRef) provider = 'mercadopago';
      else if (record.source === 'stripe' || stripeRef) provider = 'stripe';
    }

    let refundId: string | null = null;
    let refundAmount = amount;

    if (provider === 'stripe') {
      if (!stripeRef) throw new Error('Pagamento Stripe sem ID de transação — não é possível estornar pelo gateway');
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-08-27.basil' });

      // Try refunding via payment_intent first; fallback to charge if it's actually a charge id
      try {
        const refund = stripeRef.startsWith('ch_')
          ? await stripe.refunds.create({ charge: stripeRef, reason: 'requested_by_customer' })
          : await stripe.refunds.create({ payment_intent: stripeRef, reason: 'requested_by_customer' });
        refundId = refund.id;
        refundAmount = (refund.amount ?? 0) / 100;
      } catch (refundErr: any) {
        // If already refunded on Stripe, continue to subscription cancel
        const msg = String(refundErr?.message || '');
        if (!/already.*refunded|charge_already_refunded/i.test(msg)) throw refundErr;
        console.warn('[process-refund] charge already refunded on Stripe, continuing:', msg);
      }

      // Cancel subscription if this payment is linked to one (Clube)
      const subId = table === 'vip_payments' ? record.stripe_subscription_id : null;
      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          if (sub.status !== 'canceled') {
            await stripe.subscriptions.cancel(subId, { invoice_now: false, prorate: false });
            console.log('[process-refund] subscription canceled:', subId);
          }
        } catch (subErr: any) {
          console.error('[process-refund] failed to cancel subscription', subId, subErr?.message);
        }
      }
    } else if (provider === 'mercadopago') {
      if (!mpRef) throw new Error('Pagamento Mercado Pago sem ID de transação — não é possível estornar pelo gateway');
      const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
      if (!mpToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpRef}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `refund-${recordId}-${Date.now()}`,
        },
      });
      if (!mpRes.ok) {
        const t = await mpRes.text();
        throw new Error(`Mercado Pago: [${mpRes.status}] ${t}`);
      }
      const mpJson = await mpRes.json();
      refundId = String(mpJson.id);
      refundAmount = Number(mpJson.amount ?? amount);
    } else {
      // manual: just mark as refunded
      refundId = `manual-${Date.now()}`;
    }

    // Update record + revoke access
    if (table === 'vip_payments') {
      await (supabase as any).from('vip_payments').update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_amount: refundAmount,
        refund_id: refundId,
      }).eq('id', recordId);

      // Revoke Clube (Sócio) access: downgrade plan to free and remove vip bonus courses
      const userId = record.user_id;
      if (userId) {
        try {
          await (supabase as any).from('user_plans').update({
            plan: 'free',
            expires_at: null,
            source: 'refund',
          }).eq('user_id', userId);
          await (supabase as any).from('user_courses')
            .delete()
            .eq('user_id', userId)
            .eq('source', 'vip_bonus');
          console.log('[process-refund] Clube access revoked for user', userId);
        } catch (revokeErr: any) {
          console.error('[process-refund] failed to revoke Clube access', revokeErr?.message);
        }
      }
    } else {
      // Mark and remove access
      await (supabase as any).from(table).update({
        refunded_at: new Date().toISOString(),
        refund_amount: refundAmount,
        refund_id: refundId,
      }).eq('id', recordId);
      // Then delete to revoke access
      await (supabase as any).from(table).delete().eq('id', recordId);
    }

    return new Response(JSON.stringify({
      success: true,
      provider,
      refund_id: refundId,
      refund_amount: refundAmount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('process-refund error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
