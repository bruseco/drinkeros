import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Search, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

interface Recipe {
  id: string;
  title: string;
  cover_image_url: string | null;
  posted_checked_at: string | null;
}

const PAGE_SIZE = 50;

// Fisher-Yates com seed
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed || 1;
  const rng = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const AdminPostChecklist: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0); // 0 = sem shuffle
  const debouncedSearch = useDebounce(search, 300);

  // Busca TODAS as receitas (sem range) — necessário para shuffle global entre páginas.
  // 709 itens ~ payload pequeno; ok para admin.
  const { data, isLoading } = useQuery({
    queryKey: ['post-checklist-all', debouncedSearch],
    queryFn: async () => {
      let q = supabase
        .from('exclusive_posts')
        .select('id, title, cover_image_url, posted_checked_at')
        .order('title', { ascending: true })
        .limit(5000);

      if (debouncedSearch.trim()) {
        q = q.ilike('title', `%${debouncedSearch.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Recipe[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('exclusive_posts')
        .update({ posted_checked_at: checked ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-checklist-all'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao atualizar'),
  });

  // Ordena: não-marcadas primeiro (ordem alfabética OU shuffle), marcadas no final por data.
  const orderedAll = useMemo(() => {
    const all = data || [];
    const unchecked = all.filter((r) => !r.posted_checked_at);
    const checked = all
      .filter((r) => r.posted_checked_at)
      .sort(
        (a, b) =>
          new Date(a.posted_checked_at!).getTime() - new Date(b.posted_checked_at!).getTime()
      );
    const uncheckedOrdered =
      shuffleSeed > 0 ? seededShuffle(unchecked, shuffleSeed) : unchecked;
    return [...uncheckedOrdered, ...checked];
  }, [data, shuffleSeed]);

  const total = orderedAll.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const from = page * PAGE_SIZE;
    return orderedAll.slice(from, from + PAGE_SIZE);
  }, [orderedAll, page]);

  const checkedCount = useMemo(
    () => pageItems.filter((r) => r.posted_checked_at).length,
    [pageItems]
  );

  // Reset page when search changes
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const handleShuffle = () => {
    setShuffleSeed(Math.floor(Math.random() * 2147483647));
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          Checklist de Postagens
        </h1>
        <p className="text-muted-foreground">
          Marque as receitas conforme forem publicadas. Itens marcados vão para o final da lista.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas</CardTitle>
          <CardDescription>
            {total} receita(s) no total · Página {page + 1} de {totalPages}
            {shuffleSeed > 0 && ' · ordem embaralhada'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar receita..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleShuffle}
              disabled={isLoading}
              className="shrink-0"
            >
              <Shuffle className="h-4 w-4 mr-1.5" />
              Embaralhar
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {pageItems.map((r) => {
                const checked = !!r.posted_checked_at;
                return (
                  <label
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${
                      checked ? 'opacity-60' : ''
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, checked: !!v })}
                    />
                    {r.cover_image_url ? (
                      <img
                        src={r.cover_image_url}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted shrink-0" />
                    )}
                    <span
                      className={`flex-1 text-sm font-medium text-foreground ${
                        checked ? 'line-through' : ''
                      }`}
                    >
                      {r.title}
                    </span>
                    {checked && (
                      <Badge variant="secondary" className="text-xs">
                        Postada
                      </Badge>
                    )}
                  </label>
                );
              })}
              {pageItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma receita encontrada
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {checkedCount} marcadas nesta página
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPostChecklist;
