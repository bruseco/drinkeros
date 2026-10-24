import { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileDown, Loader2, ShoppingCart } from 'lucide-react';
import { useEventShoppingLists, useEventShoppingChecks, useSetEventShoppingCheck } from '@/hooks/useEventShoppingLists';
import { shoppingQuantity } from '@/lib/shoppingPlan';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import logoUrl from '@/assets/logotipo-drinkeros.png';
import { DeleteEventShoppingList } from './DeleteEventShoppingList';

export function EventShoppingLists({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const lists = useEventShoppingLists();
  const selected = lists.data?.find(list => list.id === selectedId);
  const checks = useEventShoppingChecks(selected?.id || null);
  const toggle = useSetEventShoppingCheck(selected?.id || null);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  if (lists.isLoading) return <p role="status">Carregando listas de compras…</p>;
  if (lists.isError) return <div role="alert"><p>Não foi possível carregar suas listas.</p><Button variant="outline" onClick={() => lists.refetch()}>Tentar novamente</Button></div>;
  if (!selected) return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">Listas de compras</h1><p className="mt-2 text-muted-foreground">{lists.data?.length || 0} {lists.data?.length === 1 ? 'lista gerada' : 'listas geradas'}</p></div>
    {!lists.data?.length ? <div className="rounded-2xl border border-dashed p-8 text-center"><ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhuma lista de compras ainda</p><p className="mt-2 text-sm text-muted-foreground">Abra uma lista na aba Favoritos e toque em “Gerar lista de compras”.</p></div>
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lists.data.map(list => <div key={list.id} className="relative rounded-2xl border bg-card transition-colors hover:border-primary"><button onClick={() => { setExportError(''); onSelect(list.id); }} className="w-full rounded-2xl p-5 pb-14 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lista de compras</p><h2 className="mt-2 break-words text-xl font-semibold">{list.name}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{list.plan.people} pessoas · {list.plan.total} drinks · {list.plan.items.length} itens</p>
        <p className="mt-2 text-xs text-muted-foreground">{new Date(list.created_at).toLocaleDateString('pt-BR')}</p>
      </button><div className="absolute bottom-2 right-2"><DeleteEventShoppingList id={list.id} name={list.name} /></div></div>)}</div>}
  </div>;
  const checked = new Set((checks.data || []).filter(c => c.is_checked).map(c => c.item_index));
  const items = selected.plan.items.map((item, index) => ({ item, index, done: checked.has(index) }));
  const completed = items.filter(i => i.done).length;
  const allDone = items.length > 0 && completed === items.length;
  return <section className="space-y-5">
    <div className="relative hidden h-12 items-center lg:flex"><Button variant="ghost" size="icon" aria-label="Voltar para listas de compras" onClick={() => onSelect(null)}><ArrowLeft className="h-5 w-5" /></Button><img src={logoUrl} alt="Drinkeros" className="absolute left-1/2 h-10 -translate-x-1/2 object-contain" /></div>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-muted-foreground">Lista de compras</p><h1 className="mt-1 break-words text-2xl font-bold">{selected.name}</h1><p className="mt-2 text-sm text-muted-foreground">{selected.plan.people} pessoas · {selected.plan.perPerson} drinks por pessoa · {selected.plan.total} drinks no total</p></div><DeleteEventShoppingList id={selected.id} name={selected.name} onDeleted={() => onSelect(null)} /></div>
    <div className="flex items-end gap-3">
      <div className="min-w-0 flex-1"><p className="mb-2 text-sm text-muted-foreground">{checks.isLoading ? 'Carregando checklist…' : checks.isError ? 'Progresso indisponível' : `${completed} de ${items.length} itens comprados`}</p><div role="progressbar" aria-label="Itens comprados" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={checks.isLoading || checks.isError ? undefined : completed} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${items.length && !checks.isError && !checks.isLoading ? completed / items.length * 100 : 0}%` }} /></div></div>
      <Button variant="outline" disabled={exporting} onClick={async () => {
        setExporting(true); setExportError('');
        try { const { downloadShoppingPdf } = await import('@/lib/shoppingPdf'); await downloadShoppingPdf(selected.plan); }
        catch { setExportError('Não foi possível gerar o PDF. Tente novamente.'); }
        finally { setExporting(false); }
      }} className="shrink-0">{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Gerar PDF</Button>
    </div>
    {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
    {checks.isLoading ? <p role="status">Carregando checklist…</p> : checks.isError ? <div role="alert"><p>Não foi possível carregar os itens comprados.</p><Button variant="outline" onClick={() => checks.refetch()}>Tentar novamente</Button></div> : <>
      {allDone && <div role="status" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4"><CheckCircle2 className="h-6 w-6 text-primary" /><div><p className="font-semibold">Lista completa!</p><p className="text-sm text-muted-foreground">Todos os itens foram comprados.</p></div></div>}
      {toggle.isError && <p role="alert" className="text-sm text-destructive">Não foi possível salvar a marcação. Tente novamente.</p>}
      {[false, true].map(done => {
        const group = items.filter(i => i.done === done); if (!group.length) return null;
        return <div key={String(done)} className="space-y-2"><h3 className="pt-2 text-sm font-semibold text-muted-foreground">{done ? 'Comprados' : 'Falta comprar'}</h3>{group.map(({ item, index }) => <div key={index} data-testid="shopping-item" className={'flex items-start gap-3 rounded-xl border p-4 ' + (done ? 'bg-muted/30' : 'bg-card')}>
          <Checkbox id={'shopping-check-' + selected.id + '-' + index} checked={done} disabled={toggle.isPending} onCheckedChange={value => toggle.mutate({ index, checked: value === true })} className="mt-1" />
          <Label htmlFor={'shopping-check-' + selected.id + '-' + index} className="flex-1 cursor-pointer space-y-1"><span className={'block font-semibold ' + (done ? 'text-muted-foreground line-through' : '')}>{item.name}</span><span className="block text-sm font-normal leading-relaxed text-muted-foreground">{shoppingQuantity(item)}</span></Label>
        </div>)}</div>;
      })}
      <p className="text-xs text-muted-foreground">Medidas de embalagem são referências de compra. “Complete” usa 100 ml por drink; gelo usa 300 g por drink, como estimativa.</p>
    </>}
  </section>;
}
