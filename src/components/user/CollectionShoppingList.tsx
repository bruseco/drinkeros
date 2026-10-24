import { useRef, useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { makeShoppingPlan, requireCompleteShoppingPlan, type ShoppingRecipe } from '@/lib/shoppingPlan';
import { useCreateEventShoppingList } from '@/hooks/useEventShoppingLists';

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

export function CollectionShoppingList({ name, entries, onCreated }: { name: string; entries: Entry[]; onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false), [step, setStep] = useState(1);
  const [people, setPeople] = useState('5'), [perPerson, setPerPerson] = useState('3');
  const [error, setError] = useState('');
  const [eventName, setEventName] = useState(name);
  const createList = useCreateEventShoppingList();
  const generating = useRef(false);
  const validPeople = Number.isInteger(Number(people)) && Number(people) >= 1 && Number(people) <= 1000;
  const validDrinks = Number.isInteger(Number(perPerson)) && Number(perPerson) >= 1 && Number(perPerson) <= 20;
  const generate = async () => {
    if (!validPeople || !validDrinks || !eventName.trim() || generating.current) return;
    generating.current = true;
    setError(''); setStep(3);
    try {
      const recipes = await loadShoppingRecipes(entries);
      const plan = makeShoppingPlan(eventName.trim(), recipes, Number(people), Number(perPerson));
      requireCompleteShoppingPlan(plan);
      const saved = await createList.mutateAsync(plan);
      setStep(4); setOpen(false); onCreated?.(saved.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a lista. Tente novamente.'); setStep(2); }
    finally { generating.current = false; }
  };
  return <Dialog open={open} onOpenChange={value => { if (step === 3) return; setOpen(value); if (value) { setStep(1); setError(''); } }}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={!entries.length}><ShoppingCart className="mr-2 h-4 w-4" />Gerar lista de compras</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onEscapeKeyDown={e => { if (step === 3) e.preventDefault(); }} onInteractOutside={e => { if (step === 3) e.preventDefault(); }}>
      <DialogHeader><DialogTitle>{step === 1 ? 'Quantas pessoas vão participar?' : step === 2 ? 'Quantos drinks por pessoa?' : step === 3 ? 'Gerando sua lista de compras…' : 'Sua lista está pronta!'}</DialogTitle>
        <DialogDescription>{name}{step < 3 ? ` · Etapa ${step} de 2` : ''}</DialogDescription></DialogHeader>
      {step === 1 && <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (validPeople) setStep(2); }}>
        <Label htmlFor="shopping-event">Nome do evento</Label><Input id="shopping-event" maxLength={120} required value={eventName} onChange={e => setEventName(e.target.value)} />
        <Label htmlFor="shopping-people">Número de pessoas</Label><Input id="shopping-people" autoFocus type="number" min={1} max={1000} step={1} required value={people} onChange={e => setPeople(e.target.value)} />
        <Button className="w-full" disabled={!validPeople || !eventName.trim()}>Continuar</Button>
      </form>}
      {step === 2 && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void generate(); }}>
        <Label htmlFor="shopping-drinks">Drinks por pessoa</Label><Input id="shopping-drinks" autoFocus type="number" min={1} max={20} step={1} required value={perPerson} onChange={e => setPerPerson(e.target.value)} />
        <p className="text-sm text-muted-foreground">Começamos com 3 como estimativa ajustável. {validPeople && validDrinks ? `${Number(people) * Number(perPerson)} porções no total, distribuídas entre os drinks da lista.` : ''}</p>
        <p className="text-xs text-muted-foreground">Dose de 50 ml. “Complete” considera 100 ml por drink. Gelo estimado em 300 g por drink. Compras arredondadas para embalagens inteiras, sem preços.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setStep(1)}>Voltar</Button><Button className="flex-1" disabled={!validPeople || !validDrinks}>Criar lista de compras</Button></div>
      </form>}
      {step === 3 && <div role="status" className="flex items-center gap-3 py-8"><Loader2 className="h-6 w-6 animate-spin" /><p>Organizando os ingredientes e salvando sua lista.</p></div>}
    </DialogContent>
  </Dialog>;
}
