import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDeleteEventShoppingList } from '@/hooks/useEventShoppingLists';

export function DeleteEventShoppingList({ id, name, onDeleted }: { id: string; name: string; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false), [error, setError] = useState(false);
  const remove = useDeleteEventShoppingList();
  return <AlertDialog open={open} onOpenChange={value => { if (!remove.isPending) { setOpen(value); setError(false); } }}>
    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={'Excluir lista ' + name} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Excluir a lista “{name}”?</AlertDialogTitle><AlertDialogDescription>A lista de compras e suas marcações serão excluídas. Seus favoritos serão mantidos.</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">Não foi possível excluir a lista. Tente novamente.</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async e => {
        e.preventDefault(); setError(false);
        try { await remove.mutateAsync(id); setOpen(false); onDeleted?.(); }
        catch { setError(true); }
      }}>{remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{remove.isPending ? 'Excluindo…' : 'Excluir lista'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
