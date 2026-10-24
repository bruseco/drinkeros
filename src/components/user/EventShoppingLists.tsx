import { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileDown, Loader2, ShoppingCart } from 'lucide-react';
import { useEventShoppingLists, useEventShoppingChecks, useSetEventShoppingCheck } from '@/hooks/useEventShoppingLists';
import { shoppingQuantity } from '@/lib/shoppingPlan';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function EventShoppingLists({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const lists = useEventShoppingLists();
  const selected = lists.data?.find(list => list.id === selectedId);
  const checks = useEventShoppingChecks(selected?.id || null);
  const toggle = useSetEventShoppingCheck(selected?.id || null);
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  if (lists.isLoading) return <p role="status">Carregando listas de compras…</p>;
  if (lists.isError) return <div role="alert"><p>Não foi possível carregar suas listas.</p><Button variant="outline" onClick={() => lists.refetch()}>Tentar novamente</Button></div>;
  if (!selected) return <div className="space-y-4">
    {!lists.data?.length ? <div className="rounded-2xl border border-dashed p-8 text-center"><ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhuma lista de compras ainda</p><p className="mt-2 text-sm text-muted-foreground">Abra uma lista na aba Favoritos e toque em “Gerar lista de compras”.</p></div>
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lists.data.map(list => <button key={list.id} onClick={() => { setExportError(''); onSelect(list.id); }} className="rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lista de compras</p><h2 className="mt-2 break-words text-xl font-semibold">{list.name}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{list.plan.people} pessoas · {list.plan.total} drinks · {list.plan.items.length} itens</p>
        <p className="mt-2 text-xs text-muted-foreground">{new Date(list.created_at).toLocaleDateString('pt-BR')}</p>
      </button>)}</div>}
  </div>;
  const checked = new Set((checks.data || []).filter(c => c.is_checked).map(c => c.item_index));
  const items = selected.plan.items.map((item, index) => ({ item, index, done: checked.has(index) }));
  const completed = items.filter(i => i.done).length;
  const allDone = items.length > 0 && completed === items.length;
  return <section className="space-y-5">
    <Button variant="ghost" onClick={() => onSelect(null)}><ArrowLeft className="mr-2 h-4 w-4" />Todas as listas de compras</Button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Lista de compras</p><h2 className="mt-1 break-words text-2xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-muted-foreground">{selected.plan.people} pessoas · {selected.plan.perPerson} drinks por pessoa · {selected.plan.total} drinks no total</p></div>
      <Button variant="outline" disabled={exporting} onClick={async () => {
        setExporting(true); setExportError('');
        try { const { downloadShoppingPdf } = await import('@/lib/shoppingPdf'); await downloadShoppingPdf(selected.plan); }
        catch { setExportError('Não foi possível gerar o PDF. Tente novamente.'); }
        finally { setExporting(false); }
      }}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Gerar PDF</Button>
    </div>
    {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
    {checks.isLoading ? <p role="status">Carregando checklist…</p> : checks.isError ? <div role="alert"><p>Não foi possível carregar os itens comprados.</p><Button variant="outline" onClick={() => checks.refetch()}>Tentar novamente</Button></div> : <>
      <div><p className="mb-2 text-sm text-muted-foreground">{completed} de {items.length} itens comprados</p><div role="progressbar" aria-label="Itens comprados" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={completed} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${items.length ? completed / items.length * 100 : 0}%` }} /></div></div>
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
