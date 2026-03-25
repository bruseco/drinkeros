import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecipes, useDeleteRecipe, useDuplicateRecipe, useUpdateRecipeOrder } from '@/hooks/useRecipes';
import { usePackages } from '@/hooks/usePackages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, MoreHorizontal, Pencil, Copy, Trash2, Loader2, Play, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const TranscriptBadge: React.FC<{ status: string | null }> = ({ status }) => {
  if (status === 'done') return <Badge variant="outline" className="text-xs border-primary/40 text-primary">✓ Pronta</Badge>;
  if (status === 'no_transcript') return <Badge variant="secondary" className="text-xs">Sem legenda</Badge>;
  if (status === 'error') return <Badge variant="destructive" className="text-xs">Erro</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">Pendente</Badge>;
};

const NotesBadge: React.FC<{ status: string | null }> = ({ status }) => {
  if (status === 'done') return <Badge variant="outline" className="text-xs border-primary/40 text-primary">✓ Geradas</Badge>;
  if (status === 'pending') return <Badge variant="outline" className="text-xs border-warning/40 text-warning">Aguardando</Badge>;
  if (status === 'error') return <Badge variant="destructive" className="text-xs">Erro</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>;
};

const AdminLessons: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: lessons = [], isLoading } = useRecipes({
    search,
    status: statusFilter || undefined,
    packageId: moduleFilter || undefined,
  });
  const { data: modules = [] } = usePackages();
  const deleteLesson = useDeleteRecipe();
  const duplicateLesson = useDuplicateRecipe();
  const updateOrder = useUpdateRecipeOrder();

  const isModuleFiltered = !!moduleFilter && moduleFilter !== 'all';

  // Compute stats from loaded lessons
  const transcriptDone = (lessons as any[]).filter((l) => l.transcript_status === 'done').length;
  const notesDone = (lessons as any[]).filter((l) => l.notes_status === 'done').length;
  const total = lessons.length;

  const handleDelete = async () => {
    if (deleteId) {
      await deleteLesson.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleReprocess = async (lessonId: string) => {
    setReprocessingId(lessonId);
    try {
      const { error } = await supabase
        .from('recipes')
        .update({ transcript_status: null, notes_status: null, transcript: null } as any)
        .eq('id', lessonId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Aula marcada para reprocessamento');
    } catch {
      toast.error('Erro ao reprocessar aula');
    } finally {
      setReprocessingId(null);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0 || !isModuleFiltered) return;
    const currentLesson = (lessons as any[])[index];
    const prevLesson = (lessons as any[])[index - 1];
    const currentRp = currentLesson.recipe_packages.find((rp: any) => rp.package_id === moduleFilter);
    const prevRp = prevLesson.recipe_packages.find((rp: any) => rp.package_id === moduleFilter);
    if (!currentRp || !prevRp) return;
    updateOrder.mutate([
      { id: currentRp.id, display_order: prevRp.display_order ?? index - 1 },
      { id: prevRp.id, display_order: currentRp.display_order ?? index },
    ]);
  };

  const handleMoveDown = (index: number) => {
    if (index >= lessons.length - 1 || !isModuleFiltered) return;
    const currentLesson = (lessons as any[])[index];
    const nextLesson = (lessons as any[])[index + 1];
    const currentRp = currentLesson.recipe_packages.find((rp: any) => rp.package_id === moduleFilter);
    const nextRp = nextLesson.recipe_packages.find((rp: any) => rp.package_id === moduleFilter);
    if (!currentRp || !nextRp) return;
    updateOrder.mutate([
      { id: currentRp.id, display_order: nextRp.display_order ?? index + 1 },
      { id: nextRp.id, display_order: currentRp.display_order ?? index },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aulas</h1>
          <p className="text-muted-foreground">Gerencie as aulas do curso</p>
        </div>
        <Button asChild>
          <Link to="/admin/aulas/nova">
            <Plus className="mr-2 h-4 w-4" />
            Nova Aula
          </Link>
        </Button>
      </div>

      {/* AI Processing Stats */}
      {total > 0 && (
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3 border">
          <span>📊 Exibindo <strong>{total}</strong> aulas</span>
          <span>•</span>
          <span>🎙️ Transcrições: <strong className="text-primary">{transcriptDone}</strong>/{total}</span>
          <span>•</span>
          <span>🤖 Notas IA: <strong className="text-primary">{notesDone}</strong>/{total}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar aulas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="published">Publicadas</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os módulos</SelectItem>
            {modules.map((mod) => (
              <SelectItem key={mod.id} value={mod.id}>
                {mod.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhuma aula encontrada</p>
          <Button asChild className="mt-4">
            <Link to="/admin/aulas/nova">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira aula
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {isModuleFiltered && <TableHead className="w-24">Ordem</TableHead>}
                <TableHead>Aula</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transcrição</TableHead>
                <TableHead>Notas IA</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lessons as any[]).map((lesson, index) => (
                <TableRow key={lesson.id}>
                  {isModuleFiltered && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground w-6 text-center">{index + 1}</span>
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0 || updateOrder.isPending}
                            onClick={() => handleMoveUp(index)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === lessons.length - 1 || updateOrder.isPending}
                            onClick={() => handleMoveDown(index)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {lesson.image_url ? (
                        <img
                          src={lesson.image_url}
                          alt={lesson.name}
                          className="h-10 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                          <Play className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{lesson.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lesson.servings || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={lesson.status === 'published' ? 'default' : 'secondary'}>
                      {lesson.status === 'published' ? 'Publicada' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TranscriptBadge status={lesson.transcript_status ?? null} />
                  </TableCell>
                  <TableCell>
                    <NotesBadge status={lesson.notes_status ?? null} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {lesson.recipe_packages.map((rp: any) => {
                        const mod = modules.find((m) => m.id === rp.package_id);
                        return mod ? (
                          <Badge key={rp.package_id} variant="outline" className="text-xs">
                            {mod.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/aulas/${lesson.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateLesson.mutate(lesson.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleReprocess(lesson.id)}
                          disabled={reprocessingId === lesson.id}
                        >
                          {reprocessingId === lesson.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Reprocessar IA
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(lesson.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
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
            <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A aula será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminLessons;
