import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePosts, useDeleteExclusivePost, useBulkCreateExclusivePosts } from '@/hooks/useExclusivePosts';
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
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Wine, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const AdminExclusiveContent: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: posts = [], isLoading } = useExclusivePosts();
  const deletePost = useDeleteExclusivePost();
  const bulkCreate = useBulkCreateExclusivePosts();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (deleteId) {
      await deletePost.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const downloadAndUploadImage = async (url: string, index: number): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `recipe-${Date.now()}-${index}.${ext}`;
      const { data, error } = await supabase.storage
        .from('package-covers')
        .upload(fileName, blob, { contentType: blob.type });
      if (error) return null;
      const { data: publicUrl } = supabase.storage.from('package-covers').getPublicUrl(data.path);
      return publicUrl.publicUrl;
    } catch {
      return null;
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast({ title: 'CSV vazio ou inválido', variant: 'destructive' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const rows = lines.slice(1).map(line => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
          else { current += char; }
        }
        values.push(current.trim());
        return values;
      });

      const getIdx = (name: string) => headers.findIndex(h => h.includes(name));
      const titleIdx = getIdx('titulo') !== -1 ? getIdx('titulo') : getIdx('title');
      const coverIdx = getIdx('capa') !== -1 ? getIdx('capa') : getIdx('cover') !== -1 ? getIdx('cover') : getIdx('image');
      const ingredientsIdx = getIdx('ingrediente') !== -1 ? getIdx('ingrediente') : getIdx('ingredient');
      const instructionsIdx = getIdx('preparo') !== -1 ? getIdx('preparo') : getIdx('instruction') !== -1 ? getIdx('instruction') : getIdx('modo');
      const characteristicsIdx = getIdx('caracteristic') !== -1 ? getIdx('caracteristic') : getIdx('characteristic');

      if (titleIdx === -1) {
        toast({ title: 'Coluna "titulo" não encontrada no CSV', variant: 'destructive' });
        return;
      }

      const posts = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = row[titleIdx];
        if (!title) continue;

        let coverUrl: string | null = null;
        if (coverIdx !== -1 && row[coverIdx]) {
          coverUrl = await downloadAndUploadImage(row[coverIdx], i);
        }

        const parseTags = (val: string | undefined) => val ? val.split(';').map(t => t.trim()).filter(Boolean) : [];

        posts.push({
          title,
          description: null,
          youtube_url: null,
          cover_image_url: coverUrl,
          is_published: true,
          display_order: i,
          ingredients: ingredientsIdx !== -1 ? parseTags(row[ingredientsIdx]) : [],
          instructions: instructionsIdx !== -1 ? (row[instructionsIdx] || null) : null,
          characteristics: characteristicsIdx !== -1 ? parseTags(row[characteristicsIdx]) : [],
        });
      }

      if (posts.length > 0) {
        await bulkCreate.mutateAsync(posts);
      } else {
        toast({ title: 'Nenhuma receita válida encontrada no CSV', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao processar CSV', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Receitas</h1>
          <p className="text-muted-foreground">Gerencie as receitas de drinks</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar CSV
          </Button>
          <Button asChild>
            <Link to="/admin/receitas/nova">
              <Plus className="mr-2 h-4 w-4" />
              Nova Receita
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Wine className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma receita cadastrada</p>
          <Button asChild className="mt-4">
            <Link to="/admin/receitas/nova">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira receita
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receita</TableHead>
                <TableHead>Ingredientes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {post.cover_image_url ? (
                        <img src={post.cover_image_url} alt={post.title} className="h-10 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                          <Wine className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{post.title}</span>
                        {post.characteristics?.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {post.characteristics.slice(0, 3).map((c, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {post.ingredients?.length || 0} ingredientes
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={post.is_published ? 'default' : 'secondary'}>
                      {post.is_published ? 'Publicada' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/receitas/${post.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(post.id)}>
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
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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

export default AdminExclusiveContent;
