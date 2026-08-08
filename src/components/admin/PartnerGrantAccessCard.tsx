import React, { useState } from 'react';
import { format } from 'date-fns';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PartnerProduct {
  product_type: string;
  product_id: string;
  product_name: string | null;
}

interface FoundUser {
  user_id: string;
  email: string;
  full_name: string | null;
}

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('partner-grant-access', { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
};

export const PartnerGrantAccessCard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoundUser | null>(null);
  const [productKey, setProductKey] = useState<string>('');
  const debounced = useDebounce(query, 350);

  const { data: products = [] } = useQuery({
    queryKey: ['partner-grant-products'],
    queryFn: async () => (await invoke({ action: 'products' })).products as PartnerProduct[],
  });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['partner-grant-search', debounced],
    queryFn: async () => (await invoke({ action: 'search', query: debounced })).users as FoundUser[],
    enabled: !selected && debounced.trim().length >= 3,
  });

  const { data: grants = [] } = useQuery({
    queryKey: ['partner-grants', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_access_grants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const effectiveProduct = products.length === 1
    ? `${products[0].product_type}:${products[0].product_id}`
    : productKey;

  const grant = useMutation({
    mutationFn: async () => {
      const [product_type, product_id] = effectiveProduct.split(':');
      return invoke({
        action: 'grant',
        target_user_id: selected!.user_id,
        product_type,
        product_id,
      });
    },
    onSuccess: (res) => {
      toast({
        title: res?.already_had ? 'Aluno já tinha acesso' : 'Acesso liberado',
        description: selected?.email,
      });
      setSelected(null);
      setQuery('');
      queryClient.invalidateQueries({ queryKey: ['partner-grants'] });
    },
    onError: (e: any) => toast({ title: 'Erro ao liberar', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" /> Liberar acesso ao seu produto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Digite o e-mail completo de um aluno já cadastrado na base, selecione e libere o acesso.
        </p>


        {products.length > 1 && (
          <Select value={productKey} onValueChange={setProductKey}>
            <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={`${p.product_type}:${p.product_id}`} value={`${p.product_type}:${p.product_id}`}>
                  {p.product_name || p.product_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {products.length === 0 && (
          <p className="text-sm text-destructive">Nenhum produto vinculado ao seu perfil de parceiro.</p>
        )}

        {selected ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{selected.full_name || 'Sem nome'}</p>
              <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => grant.mutate()} disabled={!effectiveProduct || grant.isPending}>
                {grant.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" /> Liberar acesso</>}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Digite o e-mail completo do aluno..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {debounced.trim().length >= 3 && (
              <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                {isFetching ? (
                  <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Digite o e-mail completo do aluno cadastrado.</div>

                ) : (
                  results.map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      onClick={() => setSelected(u)}
                      className="w-full text-left p-3 hover:bg-muted/50"
                    >
                      <p className="text-sm font-medium truncate">{u.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2">
            Acessos liberados por você <span className="text-muted-foreground">({grants.length})</span>
          </h4>
          {grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acesso liberado ainda.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {grants.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{g.target_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(g.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{g.product_name || g.product_type}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
