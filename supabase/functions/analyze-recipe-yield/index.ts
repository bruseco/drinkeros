import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
  const prompt = `Você é um especialista em mixologia. Analise a receita abaixo e calcule:
1. yield_ml: volume TOTAL final do(s) drink(s) em mililitros (somar todos os ingredientes líquidos + gelo derretido estimado ~30ml por drink se houver gelo).
2. drinks_count: quantos drinks/porções essa receita rende (se for receita de 1 copo, retornar 1; se for jarra/batch, calcular pelo volume / ~250ml).
3. serves_people: quantas pessoas serve (geralmente igual a drinks_count, exceto em batches onde cada pessoa toma mais de 1).

Se não conseguir inferir com confiança, retorne null no campo.

RECEITA: ${recipe.title}
INGREDIENTES: ${(recipe.ingredients || []).join(' | ')}
MODO DE PREPARO: ${recipe.instructions || '(sem instruções)'}
DESCRIÇÃO: ${recipe.description || '(sem descrição)'}

Responda APENAS com JSON válido no formato: {"yield_ml": number|null, "drinks_count": number|null, "serves_people": number|null}`;

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
