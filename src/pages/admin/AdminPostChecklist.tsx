import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';

interface Recipe {
  id: string;
  title: string;
  cover_image_url: string | null;
  posted_checked_at: string | null;
}

const PAGE_SIZE = 50;

const AdminPostChecklist: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['post-checklist', debouncedSearch, page],
    queryFn: async () => {
      let q = supabase
        .from('exclusive_posts')
        .select('id, title, cover_image_url, posted_checked_at', { count: 'exact' })
        // unchecked first (nulls first), then alphabetical; checked items go to the end ordered by check time
        .order('posted_checked_at', { ascending: true, nullsFirst: true })
        .order("title", { ascending: true });

      if (debouncedSearch.trim()) {
        q = q.ilike("title", `%${debouncedSearch.trim()}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { items: (data || []) as Recipe[], total: count ?? 0 };
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
      qc.invalidateQueries({ queryKey: ['post-checklist'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao atualizar'),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const checkedCount = useMemo(
    () => (data?.items || []).filter((r) => r.posted_checked_at).length,
    [data]
  );

  // Reset page when search changes
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

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
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar receita..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {(data?.items || []).map((r) => {
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
              {(data?.items || []).length === 0 && (
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
