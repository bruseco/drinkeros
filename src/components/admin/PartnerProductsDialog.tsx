import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

type ProductType = 'curso' | 'ebook' | 'combo' | 'pacote' | 'clube';

interface CatalogItem {
  key: string;
  product_type: ProductType;
  product_id: string | null;
  name: string;
  typeLabel: string;
}

const typeLabels: Record<ProductType, string> = {
  curso: 'Curso',
  ebook: 'E-book',
  combo: 'Combo',
  pacote: 'Pacote',
  clube: 'Clube',
};

const makeKey = (t: ProductType, id: string | null) => `${t}:${id ?? ''}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userLabel: string;
}

export const PartnerProductsDialog: React.FC<Props> = ({ open, onOpenChange, userId, userLabel }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const { data: catalog = [], isLoading: loadingCatalog } = useQuery({
    queryKey: ['partner-catalog'],
    enabled: open,
    queryFn: async (): Promise<CatalogItem[]> => {
      const [courses, ebooks, combos, packages] = await Promise.all([
        supabase.from('courses').select('id, name').order('name'),
        supabase.from('ebooks').select('id, name').order('name'),
        supabase.from('combos').select('id, name').order('name'),
        supabase.from('packages').select('id, name').order('name'),
      ]);

      const map = (
        rows: { id: string; name: string }[] | null,
        type: ProductType,
      ): CatalogItem[] =>
        (rows || []).map((r) => ({
          key: makeKey(type, r.id),
          product_type: type,
          product_id: r.id,
          name: r.name,
          typeLabel: typeLabels[type],
        }));

      return [
        {
          key: makeKey('clube', null),
          product_type: 'clube' as ProductType,
          product_id: null,
          name: 'Clube dos Drinkeros (assinatura)',
          typeLabel: typeLabels.clube,
        },
        ...map(courses.data as any, 'curso'),
        ...map(packages.data as any, 'pacote'),
        ...map(combos.data as any, 'combo'),
        ...map(ebooks.data as any, 'ebook'),
      ];
    },
  });

  const { data: current, isLoading: loadingCurrent } = useQuery({
    queryKey: ['partner-products', userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('partner_products')
        .select('product_type, product_id')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []) as { product_type: ProductType; product_id: string | null }[];
    },
  });

  const currentKeys = useMemo(
    () => new Set((current || []).map((r) => makeKey(r.product_type, r.product_id))),
    [current],
  );

  const effectiveSelected = selected ?? currentKeys;

  const toggle = (key: string) => {
    const next = new Set(effectiveSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const keys = Array.from(effectiveSelected);
      const { error: delError } = await (supabase as any)
        .from('partner_products')
        .delete()
        .eq('user_id', userId);
      if (delError) throw delError;

      if (keys.length > 0) {
        const rows = keys.map((k) => {
          const item = catalog.find((c) => c.key === k)!;
          return {
            user_id: userId,
            product_type: item.product_type,
            product_id: item.product_id,
            product_name: item.name,
          };
        });
        const { error } = await (supabase as any).from('partner_products').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-products', userId] });
      toast.success('Produtos do parceiro atualizados!');
      onOpenChange(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao salvar produtos'),
  });

  const filtered = catalog.filter((c) =>
    `${c.typeLabel} ${c.name}`.toLowerCase().includes(search.toLowerCase().trim()),
  );

  const loading = loadingCatalog || loadingCurrent;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelected(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Produtos do parceiro
          </DialogTitle>
          <DialogDescription>
            Selecione quais produtos <strong>{userLabel}</strong> poderá acompanhar na tela de Vendas.
            Ele verá apenas as vendas dos produtos marcados.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[45vh] overflow-y-auto rounded-md border divide-y">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </div>
          ) : (
            filtered.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
              >
                <Checkbox
                  checked={effectiveSelected.has(item.key)}
                  onCheckedChange={() => toggle(item.key)}
                />
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.typeLabel}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <div className="mr-auto text-xs text-muted-foreground self-center">
            {effectiveSelected.size} produto(s) selecionado(s)
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || loading}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
