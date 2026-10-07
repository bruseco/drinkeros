import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { brMonth, calculateRandClosing, normalizeMpPayment, type RandPayment } from '../_shared/randClosing.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Sessão inválida.' }, 401);
  const { data: allowed, error: roleError } = await db.rpc('has_role', {
    _user_id: auth.user.id, _role: 'super_admin',
  });
  if (roleError || allowed !== true) return json({ error: 'Acesso negado.' }, 403);

  try {
    const { month } = await req.json();
    if (typeof month !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
      return json({ error: 'Escolha um mês válido.' }, 400);
    }
    const { data: existing, error: existingError } = await db.from('rand_financial_closings')
      .select('*').eq('month', `${month}-01`).maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.status !== 'draft') return json({ closing: existing });
    // A failed refresh must invalidate the previous draft on the server too,
    // including after a reload or when another administrator has it open.
    const { error: invalidateError } = await db.from('rand_financial_closings')
      .update({ synced_at: '1970-01-01T00:00:00Z' }).eq('month', `${month}-01`).eq('status', 'draft');
    if (invalidateError) throw invalidateError;
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) throw new Error('Integração do Mercado Pago indisponível.');
    const { data: combo, error: comboError } = await db.from('combos').select('id').eq('slug', 'rand').single();
    if (comboError || !combo) throw new Error('Combo RAND não encontrado.');
    const { data: state, error: stateError } = await db.from('rand_closing_state').select('revision').eq('id', true).single();
    if (stateError) throw stateError;

    // Pagination is required: neither sale totals nor recognized refunds may be
    // silently truncated by PostgREST's default 1000-row limit.
    async function allRows(table: string, select: string, filter?: (q: any) => any) {
      const rows: any[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = db.from(table).select(select).order(table === 'purchases' ? 'id' : 'payment_id');
        if (filter) query = filter(query);
        const { data, error } = await query.range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) return rows;
      }
    }
    const balances = await allRows('rand_recognized_payments', '*');
    const { data: pending, error: pendingError } = await db.from('rand_financial_closings')
      .select('month,report').eq('status', 'draft').lt('month', `${month}-01`);
    if (pendingError) throw pendingError;
    const carryMonths = (pending ?? []).filter(c => Number(c.report.net_cents) < 0).map(c => String(c.month).slice(0, 7));
    const purchases = await allRows('purchases', 'transaction_id', q => q
      .eq('gateway', 'mercado_pago').eq('product_type', 'combo').eq('product_id', combo.id));
    const known = new Set<string>(purchases.map(p => String(p.transaction_id)));
    const ids = new Set<string>([...known, ...balances.map(b => String(b.payment_id))]);
    for (const closing of pending ?? []) {
      if (carryMonths.includes(String(closing.month).slice(0, 7))) {
        for (const line of closing.report.lines ?? []) ids.add(String(line.payment_id));
      }
    }
    const raw = new Map<string, Record<string, any>>();
    const mpFetch = async (path: string) => {
      const response = await fetch(`https://api.mercadopago.com${path}`, {
        headers: { Authorization: `Bearer ${mpToken}` }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Não foi possível consultar todos os pagamentos e taxas no Mercado Pago. Tente atualizar novamente.');
      return response.json();
    };
    const matchesRand = (p: Record<string, any>) =>
      (p.metadata?.product_type === 'combo' && p.metadata?.product_id === combo.id)
      || String(p.external_reference ?? '').startsWith(`combo:${combo.id}:`);

    // Search the gateway as well as the local canonical purchase history, so a
    // delayed webhook does not omit a RAND sale from the month's statement.
    const [year, number] = month.split('-').map(Number);
    const endYear = number === 12 ? year + 1 : year;
    const endMonth = number === 12 ? '01' : String(number + 1).padStart(2, '0');
    for (let offset = 0; ; offset += 100) {
      const params = new URLSearchParams({
        range: 'date_approved', begin_date: `${month}-01T00:00:00.000-03:00`,
        end_date: `${endYear}-${endMonth}-01T00:00:00.000-03:00`,
        sort: 'id', criteria: 'asc', limit: '100', offset: String(offset),
      });
      const page = await mpFetch(`/v1/payments/search?${params}`);
      if (!Array.isArray(page.results) || !Number.isFinite(Number(page.paging?.total))) {
        throw new Error('Resposta incompleta do Mercado Pago.');
      }
      for (const p of page.results) {
        if (matchesRand(p) || known.has(String(p.id))) ids.add(String(p.id));
      }
      if (offset + page.results.length >= Number(page.paging.total)) break;
      if (!page.results.length || offset >= 9900) throw new Error('Consulta incompleta: não foi possível conciliar todos os pagamentos.');
    }
    const queue = [...ids];
    let next = 0;
    // Four API requests in flight; this is ordinary I/O, not agent delegation.
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (next < queue.length) {
        const id = queue[next++];
        if (!/^\d+$/.test(id)) throw new Error('Referência de pagamento inválida no histórico RAND.');
        const payment = await mpFetch(`/v1/payments/${id}`);
        if (String(payment.id) !== id) throw new Error('Referência divergente no Mercado Pago.');
        if (!matchesRand(payment) && !known.has(id)) throw new Error('Não foi possível confirmar o produto de um pagamento já acertado.');
        raw.set(id, payment);
      }
    }));
    const payments: RandPayment[] = [];
    const recognized = new Set(balances.filter(b => b.month <= month).map(b => b.payment_id));
    for (const p of raw.values()) {
      if (!recognized.has(String(p.id)) && (!p.date_approved ||
        (brMonth(String(p.date_approved)) !== month && !carryMonths.includes(brMonth(String(p.date_approved)))))) continue;
      const normalized = normalizeMpPayment(p);
      if (normalized) payments.push(normalized);
    }
    for (const b of balances.filter(b => b.month <= month)) {
      if (!payments.some(p => p.payment_id === b.payment_id)) {
        throw new Error('Não foi possível reconciliar um pagamento de fechamento anterior.');
      }
    }
    const report = calculateRandClosing(month, payments, balances, carryMonths);
    const { data: closing, error: saveError } = await db.rpc('prepare_rand_closing', {
      p_month: `${month}-01`, p_report: report, p_revision: state.revision,
    });
    if (saveError) throw saveError;
    return json({ closing });
  } catch (error) {
    // No buyer data, raw provider payload, or credentials in responses/logs.
    console.error('[rand-closing] sync failed');
    return json({ error: error instanceof Error ? error.message : 'Não foi possível preparar o fechamento. Atualize novamente.' }, 400);
  }
});
