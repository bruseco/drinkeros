import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useExclusivePostsPaginated, useDeleteExclusivePost, useBulkCreateExclusivePosts, useUpdateExclusivePost } from '@/hooks/useExclusivePosts';
import InlineTagEditor from '@/components/admin/InlineTagEditor';
import TagManagerDialog from '@/components/admin/TagManagerDialog';
import { useExistingTags } from '@/hooks/useExistingTags';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Wine, Upload, Search, Sparkles, Droplet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseRecipeCsv } from '@/lib/recipeCsv';
import { useDebounce } from '@/hooks/useDebounce';

const AdminExclusiveContent: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; remaining: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const lastSelectedIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: existingTags } = useExistingTags();
  const [tagManagerField, setTagManagerField] = useState<'ingredients' | 'characteristics' | null>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExclusivePostsPaginated({ search: debouncedSearch, pageSize: 30 });

  const posts = data?.pages.flatMap(p => p.posts) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const deletePost = useDeleteExclusivePost();
  const updatePost = useUpdateExclusivePost();
  const bulkCreate = useBulkCreateExclusivePosts();
  const { toast } = useToast();

  const handleUpdateTags = (postId: string, field: 'ingredients' | 'characteristics', tags: string[]) => {
    updatePost.mutate({ id: postId, data: { [field]: tags } });
  };

  const handleSelect = useCallback((id: string, index: number, shiftKey: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIndex.current !== null) {
        const start = Math.min(lastSelectedIndex.current, index);
        const end = Math.max(lastSelectedIndex.current, index);
        for (let i = start; i <= end; i++) {
          next.add(posts[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastSelectedIndex.current = index;
  }, [posts]);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === posts.length) return new Set();
      return new Set(posts.map(p => p.id));
    });
  }, [posts]);

  const handleDelete = async () => {
    if (deleteId) {
      await deletePost.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from('exclusive_posts').delete().in('id', ids);
      if (error) throw error;
      toast({ title: `${ids.length} receitas excluídas com sucesso!` });
      setSelected(new Set());
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Erro ao excluir receitas', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setBulkDeleteOpen(false);
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
      const parsedRows = parseRecipeCsv(text);
      if (parsedRows.length === 0) {
        toast({ title: 'CSV vazio ou inválido', variant: 'destructive' });
        return;
      }
      const newPosts = await Promise.all(parsedRows.map(async (row, index) => {
        const coverUrl = row.coverUrl ? await downloadAndUploadImage(row.coverUrl, index) : null;
        return {
          title: row.title,
          description: null,
          youtube_url: row.youtubeUrl,
          cover_image_url: coverUrl,
          is_published: true,
          display_order: index,
          ingredients: row.ingredients,
          instructions: row.instructions,
          characteristics: row.characteristics,
        };
      }));
      if (newPosts.length > 0) {
        await bulkCreate.mutateAsync(newPosts);
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

  const handleAnalyzeYield = async (force = false) => {
    setIsAnalyzing(true);
    setAnalyzeProgress({ done: 0, remaining: 0 });
    try {
      let totalDone = 0;
      // Loop em lotes até zerar pendentes
      while (true) {
        const { data, error } = await supabase.functions.invoke('analyze-recipe-yield', {
          body: { batch_size: 10, force },
        });
        if (error) throw error;
        const processed = data?.processed ?? 0;
        const remaining = data?.remaining ?? 0;
        totalDone += processed;
        setAnalyzeProgress({ done: totalDone, remaining });
        if (processed === 0 || (force && totalDone >= 1000)) break;
        // pequena pausa entre lotes
        await new Promise((r) => setTimeout(r, 500));
      }
      toast({ title: `Análise concluída`, description: `${totalDone} receita(s) atualizada(s).` });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Erro ao analisar rendimento', description: err.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
      setAnalyzeProgress(null);
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
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, ingrediente ou característica..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tag management buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setTagManagerField('ingredients')}>
          🧪 Ingredientes ({existingTags?.ingredients.length ?? 0})
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTagManagerField('characteristics')}>
          🏷️ Características ({existingTags?.characteristics.length ?? 0})
        </Button>
      </div>

      {/* Tag Manager Dialog */}
      <TagManagerDialog
        open={tagManagerField !== null}
        onClose={() => setTagManagerField(null)}
        field={tagManagerField ?? 'ingredients'}
        tags={tagManagerField === 'characteristics' ? (existingTags?.characteristics ?? []) : (existingTags?.ingredients ?? [])}
      />

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Excluir selecionadas
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Wine className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {debouncedSearch ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}
          </p>
          {!debouncedSearch && (
            <Button asChild className="mt-4">
              <Link to="/admin/receitas/nova"><Plus className="mr-2 h-4 w-4" />Criar primeira receita</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">{total} receita(s) encontrada(s)</div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={selected.size === posts.length && posts.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Receita</TableHead>
                  <TableHead>Ingredientes</TableHead>
                  <TableHead>Características</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post, index) => (
                  <TableRow key={post.id} data-state={selected.has(post.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(post.id)}
                        onClick={(e) => { e.stopPropagation(); handleSelect(post.id, index, e.shiftKey); }}
                        onCheckedChange={() => {}}
                      />
                    </TableCell>
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
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <InlineTagEditor
                        tags={post.ingredients || []}
                        onSave={(tags) => handleUpdateTags(post.id, 'ingredients', tags)}
                        placeholder="Adicionar ingrediente..."
                        suggestions={existingTags?.ingredients || []}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineTagEditor
                        tags={post.characteristics || []}
                        onSave={(tags) => handleUpdateTags(post.id, 'characteristics', tags)}
                        placeholder="Adicionar característica..."
                        suggestions={existingTags?.characteristics || []}
                      />
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

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Carregar mais
              </Button>
            </div>
          )}
        </>
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} receitas?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todas as receitas selecionadas serão removidas permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir {selected.size} receitas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminExclusiveContent;
