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
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, ShoppingBag } from 'lucide-react';

const AdminProdutos: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: produtos = [], isLoading } = useCombos();
  const deleteProduto = useDeleteCombo();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProduto.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pacotes</h1>
          <p className="text-muted-foreground">Monte combos de cursos e e-books para liberar acesso em conjunto</p>
        </div>
        <Button asChild>
          <Link to="/admin/produtos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo Pacote
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : produtos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum pacote encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/admin/produtos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro pacote
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pacote</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => (
                <TableRow key={produto.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {produto.cover_image_url ? (
                        <img src={produto.cover_image_url} alt={produto.name} className="h-10 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{produto.name}</span>
                        {produto.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{produto.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(produto as any).price ? (
                      <span className="text-sm font-medium">R$ {Number((produto as any).price).toFixed(2)}</span>
                    ) : produto.is_free ? (
                      <span className="text-sm text-muted-foreground">Gratuito</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={produto.is_active ? 'default' : 'secondary'}>
                        {produto.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {produto.is_free && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Gratuito</Badge>
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
                          <Link to={`/admin/produtos/${produto.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(produto.id)}>
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
            <AlertDialogTitle>Excluir pacote?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O pacote será removido permanentemente.</AlertDialogDescription>
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

export default AdminProdutos;
