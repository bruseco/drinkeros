import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Sempre tenta fechar o mês anterior
    const { data: monthly, error: mErr } = await supabase.rpc('close_monthly_battle');
    if (mErr) throw mErr;

    // Se for janeiro (mês atual = 1 em BRT), fecha também o ano anterior
    const nowBrt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    let yearly: unknown = null;
    if (nowBrt.getMonth() === 0) {
      const { data: y, error: yErr } = await supabase.rpc('close_yearly_battle');
      if (yErr) throw yErr;
      yearly = y;
    }

    return new Response(JSON.stringify({ monthly, yearly }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
