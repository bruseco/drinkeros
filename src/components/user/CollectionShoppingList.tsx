import { useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { makeShoppingPlan, type ShoppingRecipe } from '@/lib/shoppingPlan';
import logoUrl from '@/assets/logotipo-drinkeros.png';

type Entry = { recipe_id: string; kind: 'aula' | 'receita' | 'clube' | null };
const lines = (value: string | null) => (value || '').split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 160);
async function loadShoppingRecipes(entries: Entry[]): Promise<ShoppingRecipe[]> {
  const result = new Map<string, ShoppingRecipe>();
  for (let offset = 0; offset < entries.length; offset += 100) {
    const batch = entries.slice(offset, offset + 100);
    for (const kind of ['aula', 'receita', 'clube'] as const) {
      const ids = [...new Set(batch.filter(e => e.kind === kind).map(e => e.recipe_id))]; if (!ids.length) continue;
      if (kind === 'receita') {
        const { data, error } = await supabase.from('exclusive_posts').select('id,title,ingredients,instructions,drinks_count,cover_image_url').in('id', ids);
        if (error) throw error;
        for (const r of data || []) result.set(r.id, { id: r.id, name: r.title, ingredients: r.ingredients || [], instructions: r.instructions, yield: r.drinks_count, image: r.cover_image_url });
      } else if (kind === 'clube') {
        const { data, error } = await supabase.from('club_recipes').select('id,name,ingredients,instructions,image_url').in('id', ids);
        if (error) throw error;
        for (const r of data || []) result.set(r.id, { id: r.id, name: r.name, ingredients: lines(r.ingredients), instructions: r.instructions, image: r.image_url });
      } else {
        const { data, error } = await supabase.from('recipes').select('id,name,ingredients,instructions,servings,image_url').in('id', ids);
        if (error) throw error;
        for (const r of data || []) {
          const count = r.servings?.match(/^(\d+)\s*(?:drinks?|porções|porcoes|doses?)\b/i);
          result.set(r.id, { id: r.id, name: r.name, ingredients: lines(r.ingredients), instructions: r.instructions, yield: count ? Number(count[1]) : null, image: r.image_url });
        }
      }
    }
  }
  const ids = [...new Set(entries.map(e => e.recipe_id))];
  if (ids.some(id => !result.has(id))) throw new Error('Algumas receitas não puderam ser carregadas. Atualize a lista e tente novamente.');
  return ids.map(id => result.get(id)!);
}

export function CollectionShoppingList({ name, entries }: { name: string; entries: Entry[] }) {
  const [open, setOpen] = useState(false), [step, setStep] = useState(1);
  const [people, setPeople] = useState('5'), [perPerson, setPerPerson] = useState('3');
  const [error, setError] = useState('');
  const [warningCount, setWarningCount] = useState(0);
  const validPeople = Number.isInteger(Number(people)) && Number(people) >= 1 && Number(people) <= 1000;
  const validDrinks = Number.isInteger(Number(perPerson)) && Number(perPerson) >= 1 && Number(perPerson) <= 20;
  const generate = async () => {
    if (!validPeople || !validDrinks) return;
    setError(''); setStep(3);
    try {
      const recipes = await loadShoppingRecipes(entries);
      const plan = makeShoppingPlan(name, recipes, Number(people), Number(perPerson));
      const { createShoppingPdf, shoppingImage } = await import('@/lib/shoppingPdf');
      const images: Record<string, string> = {};
      // Bounded parallel image loading keeps long lists responsive on mobile.
      for (let offset = 0; offset < recipes.length; offset += 4) await Promise.all(recipes.slice(offset, offset + 4).map(async r => {
        if (r.image) { const image = await shoppingImage(r.image); if (image) images[r.id] = image; }
      }));
      const logo = await shoppingImage(logoUrl);
      createShoppingPdf(plan, images, logo).save(`lista-de-compras-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'drinkeros'}.pdf`);
      setWarningCount(plan.items.filter(i => i.quantity == null).length + plan.warnings.length); setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível gerar o PDF. Tente novamente.'); setStep(2); }
  };
  return <Dialog open={open} onOpenChange={value => { if (step === 3) return; setOpen(value); if (value) { setStep(1); setError(''); } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={!entries.length}><ShoppingCart className="mr-2 h-4 w-4" />Gerar lista de compras</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onEscapeKeyDown={e => { if (step === 3) e.preventDefault(); }} onInteractOutside={e => { if (step === 3) e.preventDefault(); }}>
      <DialogHeader><DialogTitle>{step === 1 ? 'Quantas pessoas vão participar?' : step === 2 ? 'Quantos drinks por pessoa?' : step === 3 ? 'Gerando sua lista de compras…' : 'Sua lista está pronta!'}</DialogTitle>
        <DialogDescription>{name}{step < 3 ? ` · Etapa ${step} de 2` : ''}</DialogDescription></DialogHeader>
      {step === 1 && <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (validPeople) setStep(2); }}>
        <Label htmlFor="shopping-people">Número de pessoas</Label><Input id="shopping-people" autoFocus type="number" min={1} max={1000} step={1} required value={people} onChange={e => setPeople(e.target.value)} />
        <Button className="w-full" disabled={!validPeople}>Continuar</Button>
      </form>}
      {step === 2 && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void generate(); }}>
        <Label htmlFor="shopping-drinks">Drinks por pessoa</Label><Input id="shopping-drinks" autoFocus type="number" min={1} max={20} step={1} required value={perPerson} onChange={e => setPerPerson(e.target.value)} />
        <p className="text-sm text-muted-foreground">Começamos com 3 como estimativa ajustável. {validPeople && validDrinks ? `${Number(people) * Number(perPerson)} porções no total, distribuídas entre os drinks da lista.` : ''}</p>
        <p className="text-xs text-muted-foreground">Medidas e rendimentos ausentes serão sinalizados no PDF como quantidades a conferir. Sem estimativa de preços.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setStep(1)}>Voltar</Button><Button className="flex-1" disabled={!validPeople || !validDrinks}>Gerar PDF</Button></div>
      </form>}
      {step === 3 && <div role="status" className="flex items-center gap-3 py-8"><Loader2 className="h-6 w-6 animate-spin" /><p>Organizando os ingredientes e preparando seu PDF.</p></div>}
      {step === 4 && <div className="space-y-4"><p>O PDF foi gerado. Confira o download no seu navegador.</p>{warningCount > 0 && <p className="text-sm text-muted-foreground">Há ingredientes ou rendimentos que precisam de conferência. Os avisos estão destacados no PDF.</p>}<Button onClick={() => setOpen(false)}>Concluir</Button></div>}
    </DialogContent>
  </Dialog>;
}
