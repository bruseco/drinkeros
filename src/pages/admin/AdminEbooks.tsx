import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEbooks, useDeleteEbook } from '@/hooks/useEbooks';
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
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, FileText } from 'lucide-react';

const AdminEbooks: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: ebooks = [], isLoading } = useEbooks();
  const deleteEbook = useDeleteEbook();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteEbook.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">E-books</h1>
          <p className="text-muted-foreground">Gerencie os e-books disponíveis</p>
        </div>
        <Button asChild>
          <Link to="/admin/ebooks/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo E-book
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : ebooks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum e-book encontrado</p>
          <Button asChild className="mt-4">
            <Link to="/admin/ebooks/novo">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro e-book
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-book</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ebooks.map((ebook) => (
                <TableRow key={ebook.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {ebook.cover_image_url ? (
                        <img src={ebook.cover_image_url} alt={ebook.name} className="h-10 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{ebook.name}</span>
                        {ebook.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{ebook.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ebook.price ? (
                      <span className="text-sm font-medium">R$ {Number(ebook.price).toFixed(2)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ebook.is_active ? 'default' : 'secondary'}>
                      {ebook.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/ebooks/${ebook.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(ebook.id)}>
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
            <AlertDialogTitle>Excluir e-book?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O e-book será removido permanentemente.</AlertDialogDescription>
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

export default AdminEbooks;
