import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCombos, useDeleteCombo } from '@/hooks/useCombos';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Layers } from 'lucide-react';

const AdminCombos: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: combos = [], isLoading } = useCombos();
  const deleteCombo = useDeleteCombo();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCombo.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Combos</h1>
          <p className="text-muted-foreground">Gerencie os combos (bundles de cursos)</p>
        </div>
        <Button asChild>
          <Link to="/admin/combos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Combo
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : combos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum combo encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/admin/combos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro combo
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combo</TableHead>
                <TableHead>Link Checkout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combos.map((combo) => (
                <TableRow key={combo.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {combo.cover_image_url ? (
                        <img src={combo.cover_image_url} alt={combo.name} className="h-10 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{combo.name}</span>
                        {combo.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{combo.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {combo.is_free ? (
                      <span className="text-sm text-muted-foreground">-</span>
                    ) : combo.checkout_url ? (
                      <a href={combo.checkout_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm truncate block max-w-[200px]">
                        {combo.checkout_url}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={combo.is_active ? 'default' : 'secondary'}>
                        {combo.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {combo.is_free && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Gratuito</Badge>
                      )}
                      {!combo.is_free && combo.is_available_for_sale && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">À venda</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/combos/${combo.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(combo.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir combo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O combo será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCombos;
