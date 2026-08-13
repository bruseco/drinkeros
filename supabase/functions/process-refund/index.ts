import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { revokeClubeAccess } from "./revoke.ts";

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
        const result = await revokeClubeAccess(supabase, userId);
        if (result.errors.length) {
          console.error('[process-refund] revoke errors', result.errors);
        } else {
          console.log('[process-refund] Clube access revoked for user', userId);
        }
      }
    } else {
      const now = new Date().toISOString();
      // Mantém o registro (histórico/relatório de vendas) mas revoga o acesso
      // expirando-o. NÃO deletamos mais: a exclusão fazia os produtos internos
      // do combo reaparecerem como vendas avulsas com valor cheio.
      await (supabase as any).from(table).update({
        refunded_at: now,
        refund_amount: refundAmount,
        refund_id: refundId,
        expires_at: now,
      }).eq('id', recordId);

      // Revoga os acessos propagados (cursos/ebooks liberados pelo combo)
      if (table === 'user_combos' && record.user_id && record.combo_id) {
        const [{ data: cc }, { data: ce }] = await Promise.all([
          (supabase as any).from('combo_courses').select('course_id').eq('combo_id', record.combo_id),
          (supabase as any).from('combo_ebooks').select('ebook_id').eq('combo_id', record.combo_id),
        ]);
        const courseIds = (cc || []).map((r: any) => r.course_id);
        const ebookIds = (ce || []).map((r: any) => r.ebook_id);
        if (courseIds.length) {
          await (supabase as any).from('user_courses')
            .update({ refunded_at: now, expires_at: now })
            .eq('user_id', record.user_id).in('course_id', courseIds).is('refunded_at', null);
        }
        if (ebookIds.length) {
          await (supabase as any).from('user_ebooks')
            .update({ refunded_at: now, expires_at: now })
            .eq('user_id', record.user_id).in('ebook_id', ebookIds).is('refunded_at', null);
        }

      }

      // Revoga o acesso exclusivo (Receitas) liberado pela compra estornada,
      // desde que o usuário não seja Sócio ativo nem Vitalício.
      if (record.user_id) {
        const [{ data: planRow }, { data: lifetimeRow }] = await Promise.all([
          (supabase as any).from('user_plans').select('plan, expires_at').eq('user_id', record.user_id).maybeSingle(),
          (supabase as any).from('user_lifetime_access').select('id').eq('user_id', record.user_id).maybeSingle(),
        ]);
        const isVipActive = planRow?.plan === 'vip' &&
          (!planRow?.expires_at || new Date(planRow.expires_at) > new Date());
        if (!lifetimeRow && !isVipActive) {
          await (supabase as any).from('user_exclusive_access')
            .update({ expires_at: now })
            .eq('user_id', record.user_id)
            .eq('feature', 'receitas');
        }
      }
    }


    // Marca a compra correspondente como estornada (evita contar no faturamento)
    const txRef = mpRef || stripeRef;
    if (txRef) {
      await (supabase as any)
        .from('purchases')
        .update({ status: 'refunded' })
        .eq('transaction_id', txRef);
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
