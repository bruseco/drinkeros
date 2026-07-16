import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertInternalOrAdmin } from "../_shared/internalAuth.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  ingredients: string[] | null;
}

interface YieldResult {
  yield_ml: number | null;
  drinks_count: number | null;
  serves_people: number | null;
}

async function analyzeRecipe(recipe: RecipeRow): Promise<YieldResult> {
  const prompt = `Você é um especialista em mixologia brasileira. Analise a receita abaixo e calcule o rendimento.

REGRAS DE CONVERSÃO DE MEDIDAS (use sempre que aparecerem, mesmo em descrição/modo de preparo):
- 1 dose = 50 ml
- 1/2 dose = 25 ml
- 1 shot = 40 ml
- 1 colher de sopa = 15 ml
- 1 colher de chá = 5 ml
- 1 xícara = 240 ml
- 1 copo (americano/médio) = 200 ml
- 1 copo de cachaça = 200 ml
- 1 taça = 150 ml
- 1 lata (refrigerante/cerveja padrão BR, ex: Schweppes, Coca, Antarctica) = 350 ml
- 1 latão = 473 ml
- 1 garrafa long neck = 355 ml
- 1 garrafa de cerveja 600ml = 600 ml
- 1 garrafa de destilado padrão = 750 ml
- 1 litro = 1000 ml
- 1/2 melancia média = ~2000 ml de polpa líquida
- 1 melancia inteira = ~4000 ml
- 1 caixa de morango/frutas vermelhas = ~250 ml de fruta
- 1 abacaxi médio (suco) = ~800 ml
- 1 limão (suco) = ~30 ml
- 1 laranja (suco) = ~100 ml
- Suco de "2 limões" = 60 ml, "5 limões" = 150 ml, etc.
- Gelo: somar ~50 ml de gelo derretido por drink final servido
- Frutas em cubos/decoração: contar volume aproximado da fruta inteira
- Ignore guarnições simples (folhas de hortelã, rodelas decorativas) no cálculo de volume

CALCULE:
1. yield_ml: volume TOTAL final da receita em ml (some TODOS os líquidos + frutas batidas + gelo derretido estimado). Seja generoso com batches grandes (jarras, ponches, melancia recheada normalmente passam de 3000 ml).
2. drinks_count: quantos drinks/porções rende. Para batches grandes: divida o volume total por ~250 ml (tamanho médio de uma porção servida). Receita de copo único = 1.
3. serves_people: geralmente IGUAL a drinks_count.

IMPORTANTE: Leia TODO o modo de preparo procurando medidas. Se a receita menciona "1 melancia", "2 copos", "1 lata", "1 jarra", "rende X pessoas", "para a festa" → é BATCH, não 1 drink. NUNCA retorne null se houver QUALQUER pista de volume; estime com base nas regras acima.

RECEITA: ${recipe.title}
INGREDIENTES: ${(recipe.ingredients || []).join(' | ')}
MODO DE PREPARO: ${recipe.instructions || '(sem instruções)'}
DESCRIÇÃO: ${recipe.description || '(sem descrição)'}

Responda APENAS com JSON válido: {"yield_ml": number|null, "drinks_count": number|null, "serves_people": number|null}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  const toIntOrNull = (v: unknown) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  return {
    yield_ml: toIntOrNull(parsed.yield_ml),
    drinks_count: toIntOrNull(parsed.drinks_count),
    serves_people: toIntOrNull(parsed.serves_people),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const _authFail = await assertInternalOrAdmin(req, corsHeaders);
  if (_authFail) return _authFail;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { recipe_id, force = false, batch_size = 10 } = body || {};

    let recipes: RecipeRow[] = [];

    if (recipe_id) {
      const { data, error } = await supabase
        .from('exclusive_posts')
        .select('id, title, description, instructions, ingredients')
        .eq('id', recipe_id)
        .limit(1);
      if (error) throw error;
      recipes = (data || []) as RecipeRow[];
    } else {
      let q = supabase
        .from('exclusive_posts')
        .select('id, title, description, instructions, ingredients')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(Number(batch_size) || 10, 1), 50));
      if (!force) q = q.is('yield_analyzed_at', null);
      const { data, error } = await q;
      if (error) throw error;
      recipes = (data || []) as RecipeRow[];
    }

    const results: Array<{ id: string; ok: boolean; error?: string; result?: YieldResult }> = [];

    for (const r of recipes) {
      try {
        const yieldData = await analyzeRecipe(r);
        const { error: upErr } = await supabase
          .from('exclusive_posts')
          .update({
            yield_ml: yieldData.yield_ml,
            drinks_count: yieldData.drinks_count,
            serves_people: yieldData.serves_people,
            yield_analyzed_at: new Date().toISOString(),
          })
          .eq('id', r.id);
        if (upErr) throw upErr;
        results.push({ id: r.id, ok: true, result: yieldData });
      } catch (e: any) {
        results.push({ id: r.id, ok: false, error: e?.message || String(e) });
      }
    }

    const { count: remaining } = await supabase
      .from('exclusive_posts')
      .select('id', { count: 'exact', head: true })
      .is('yield_analyzed_at', null);

    return new Response(
      JSON.stringify({ processed: results.length, remaining: remaining ?? 0, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('analyze-recipe-yield error', e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
