import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { useClubeSettings } from '@/hooks/useClubeSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, ExternalLink, Copy, RefreshCw, BookOpen, FileText, CheckCircle2, AlertCircle,
  Crown, FlaskConical, Trophy, Pause, Play, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

interface SaleRow {
  id: string;
  page_key: string;
  name: string;
  slug: string;
  original_path: string;
  variant_path: string;
  cover: string | null;
  price: number | null;
  is_available_for_sale: boolean;
  stripe_price_id: string | null;
  type: 'club' | 'course' | 'ebook';
  edit_path?: string;
}

interface AbTest {
  id: string;
  page_key: string;
  page_label: string;
  original_path: string;
  variant_path: string;
  traffic_split_pct: number;
  status: 'active' | 'paused' | 'finished';
  winner: 'a' | 'b' | null;
  visits_a: number;
  visits_b: number;
  conversions_a: number;
  conversions_b: number;
}

const fmtPct = (conv: number, visits: number) =>
  visits > 0 ? ((conv / visits) * 100).toFixed(2) + '%' : '—';

const AbTestBox: React.FC<{
  row: SaleRow;
  test: AbTest | undefined;
  onChanged: () => void;
}> = ({ row, test, onChanged }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [split, setSplit] = useState<number>(test?.traffic_split_pct ?? 50);
  const [variantPath, setVariantPath] = useState<string>(
    test?.variant_path ?? `${row.original_path}-b`,
  );

  const activate = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('ab_tests' as any).upsert(
        {
          page_key: row.page_key,
          page_label: row.name,
          original_path: row.original_path,
          variant_path: variantPath,
          traffic_split_pct: split,
          status: 'active',
          winner: null,
        },
        { onConflict: 'page_key' },
      );
      if (error) throw error;
      toast({ title: 'Teste A/B ativado!', description: `Variante: ${variantPath}` });
      onChanged();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const updateSplit = async (newSplit: number) => {
    if (!test) return;
    setSplit(newSplit);
    await supabase.from('ab_tests' as any).update({ traffic_split_pct: newSplit }).eq('id', test.id);
    onChanged();
  };

  const togglePause = async () => {
    if (!test) return;
    const next = test.status === 'active' ? 'paused' : 'active';
    await supabase.from('ab_tests' as any).update({ status: next }).eq('id', test.id);
    toast({ title: next === 'active' ? 'Teste retomado' : 'Teste pausado' });
    onChanged();
  };

  const declareWinner = async (winner: 'a' | 'b') => {
    if (!test) return;
    if (!confirm(`Definir ${winner.toUpperCase()} como vencedor? 100% do tráfego vai pra essa variante.`)) return;
    await supabase.from('ab_tests' as any).update({
      status: 'finished',
      winner,
      finished_at: new Date().toISOString(),
    }).eq('id', test.id);
    toast({ title: `Vencedor definido: ${winner.toUpperCase()}` });
    onChanged();
  };

  const remove = async () => {
    if (!test) return;
    if (!confirm('Encerrar e remover este teste A/B? O tráfego volta 100% para a variante A.')) return;
    await supabase.from('ab_tests' as any).delete().eq('id', test.id);
    toast({ title: 'Teste removido' });
    onChanged();
  };

  const copyVariant = () => {
    const url = `${ORIGIN}${test?.variant_path ?? variantPath}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link da variante copiado', description: url });
  };

  if (!test) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="h-4 w-4 text-primary" /> Configurar teste A/B
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Caminho da variante B</label>
            <Input value={variantPath} onChange={(e) => setVariantPath(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tráfego para B: {split}%</label>
            <Slider value={[split]} onValueChange={(v) => setSplit(v[0])} max={100} step={5} className="w-48" />
          </div>
        </div>
        <Button onClick={activate} disabled={busy} size="sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" /> Ativar Teste A/B</>}
        </Button>
        <p className="text-xs text-muted-foreground">
          Depois de ativar, peça ao Lovable pra duplicar o arquivo da página original
          em um novo arquivo (ex: <code>VipLandingB.tsx</code>) e ligar à rota acima — daí você edita
          a variante B livremente.
        </p>
      </div>
    );
  }

  const convA = fmtPct(test.conversions_a, test.visits_a);
  const convB = fmtPct(test.conversions_b, test.visits_b);
  const variantUrl = `${ORIGIN}${test.variant_path}`;

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="h-4 w-4 text-primary" /> Teste A/B
          <Badge variant={test.status === 'active' ? 'default' : test.status === 'paused' ? 'secondary' : 'outline'}>
            {test.status === 'active' ? 'Ativo' : test.status === 'paused' ? 'Pausado' : 'Encerrado'}
          </Badge>
          {test.winner && (
            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
              <Trophy className="h-3 w-3 mr-1" /> Vencedor: {test.winner.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {test.status !== 'finished' && (
            <Button size="sm" variant="ghost" onClick={togglePause}>
              {test.status === 'active' ? <><Pause className="h-3 w-3 mr-1" /> Pausar</> : <><Play className="h-3 w-3 mr-1" /> Retomar</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={remove}>
            <Trash2 className="h-3 w-3 mr-1" /> Remover
          </Button>
        </div>
      </div>

      <div className="text-sm">
        <span className="text-muted-foreground">Link da variante B: </span>
        <a href={variantUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
          {variantUrl} <ExternalLink className="h-3 w-3" />
        </a>
        <Button size="sm" variant="ghost" className="ml-1 h-6 px-2" onClick={copyVariant}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {test.status === 'active' && (
        <div>
          <label className="text-xs text-muted-foreground">Distribuição: A={100 - split}% · B={split}%</label>
          <Slider value={[split]} onValueChange={(v) => setSplit(v[0])} onValueCommit={(v) => updateSplit(v[0])} max={100} step={5} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Variante A (original)</span>
            {!test.winner && test.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => declareWinner('a')}>
                <Trophy className="h-3 w-3 mr-1" /> Vencedor
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Visitas</div>
          <div className="text-2xl font-bold">{test.visits_a.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-muted-foreground mt-2">Cliques no checkout</div>
          <div className="text-lg font-semibold">{test.conversions_a.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-muted-foreground mt-1">Conversão: <span className="font-medium text-foreground">{convA}</span></div>
        </div>
        <div className="rounded border bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Variante B</span>
            {!test.winner && test.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => declareWinner('b')}>
                <Trophy className="h-3 w-3 mr-1" /> Vencedor
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Visitas</div>
          <div className="text-2xl font-bold">{test.visits_b.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-muted-foreground mt-2">Cliques no checkout</div>
          <div className="text-lg font-semibold">{test.conversions_b.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-muted-foreground mt-1">Conversão: <span className="font-medium text-foreground">{convB}</span></div>
        </div>
      </div>
    </div>
  );
};

const AdminSalesPages: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: ebooks = [], isLoading: ebooksLoading } = useEbooks();
  const { data: clubeSettings } = useClubeSettings();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: tests = [], refetch: refetchTests } = useQuery({
    queryKey: ['admin-ab-tests'],
    queryFn: async () => {
      const { data } = await supabase.from('ab_tests' as any).select('*');
      return (data ?? []) as unknown as AbTest[];
    },
    refetchInterval: 30_000,
  });

  const testByKey = new Map(tests.map((t) => [t.page_key, t]));

  const isLoading = coursesLoading || ebooksLoading;

  const rows: SaleRow[] = [
    {
      id: 'clube',
      page_key: 'clube',
      name: 'Clube dos Drinkeros',
      slug: 'clube',
      original_path: '/clube',
      variant_path: '/clube-b',
      cover: null,
      price: clubeSettings?.full_price ?? 197,
      is_available_for_sale: true,
      stripe_price_id: 'managed',
      type: 'club' as const,
      edit_path: '/admin/clube',
    },
    ...courses.map((c: any) => ({
      id: c.id,
      page_key: `course:${c.id}`,
      name: c.name,
      slug: c.slug,
      original_path: `/${c.slug}`,
      variant_path: `/${c.slug}-b`,
      cover: c.cover_image_url,
      price: c.price ? Number(c.price) : null,
      is_available_for_sale: c.is_available_for_sale,
      stripe_price_id: c.stripe_price_id ?? null,
      type: 'course' as const,
      edit_path: `/admin/cursos/${c.id}`,
    })),
    ...ebooks.map((e: any) => ({
      id: e.id,
      page_key: `ebook:${e.id}`,
      name: e.name,
      slug: e.slug,
      original_path: `/${e.slug}`,
      variant_path: `/${e.slug}-b`,
      cover: e.cover_image_url,
      price: e.price ? Number(e.price) : null,
      is_available_for_sale: e.is_active,
      stripe_price_id: e.stripe_price_id ?? null,
      type: 'ebook' as const,
      edit_path: `/admin/ebooks/${e.id}`,
    })),
  ];

  const handleCopyLink = (path: string) => {
    const url = `${ORIGIN}${path}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!', description: url });
  };

  const handleSync = async (row: SaleRow) => {
    if (row.type === 'club') return;
    if (!row.price || row.price <= 0) {
      toast({
        title: 'Defina o preço primeiro',
        description: 'Edite o produto e cadastre um preço maior que zero.',
        variant: 'destructive',
      });
      return;
    }
    setSyncingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-product', {
        body: { product_type: row.type, product_id: row.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'Sincronizado com Stripe!', description: 'Pronto para receber pagamentos.' });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['ebooks'] });
    } catch (err: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Páginas de Venda</h1>
        <p className="text-muted-foreground">
          Cada página tem um link público e pode rodar um teste A/B com variante duplicada e split de tráfego.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhuma página de venda cadastrada ainda.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Página</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>Link público</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const url = `${ORIGIN}${row.original_path}`;
                const synced = !!row.stripe_price_id;
                const test = testByKey.get(row.page_key);
                const isOpen = !!expanded[row.page_key] || !!test;
                const typeLabel = row.type === 'club' ? 'Assinatura' : 'Compra';

                return (
                  <React.Fragment key={row.page_key}>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {row.cover ? (
                            <img src={row.cover} alt={row.name} className="h-10 w-16 rounded-md object-cover" />
                          ) : (
                            <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                              {row.type === 'club' ? <Crown className="h-4 w-4 text-amber-500" /> :
                               row.type === 'course' ? <BookOpen className="h-4 w-4 text-muted-foreground" /> :
                               <FileText className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">{row.name}</span>
                            {!row.is_available_for_sale && (
                              <Badge variant="secondary" className="ml-2 text-xs">Indisponível</Badge>
                            )}
                            {test && (
                              <Badge className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                                <FlaskConical className="h-3 w-3 mr-1" /> A/B {test.status === 'active' ? 'ativo' : test.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{typeLabel}</Badge></TableCell>
                      <TableCell>
                        {row.price ? (
                          <span className="text-sm font-medium">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.price)}
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.type === 'club' ? (
                          <Badge variant="outline" className="text-xs">Gerenciado</Badge>
                        ) : synced ? (
                          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/15">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-500/40">
                            <AlertCircle className="h-3 w-3 mr-1" /> Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate inline-flex items-center gap-1 max-w-[260px]"
                          title={url}
                        >
                          {row.original_path}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => handleCopyLink(row.original_path)}>
                            <Copy className="h-4 w-4 mr-1" /> Copiar
                          </Button>
                          <Button
                            variant={isOpen ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setExpanded((p) => ({ ...p, [row.page_key]: !isOpen }))}
                          >
                            <FlaskConical className="h-4 w-4 mr-1" /> A/B
                            {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                          </Button>
                          {row.type !== 'club' && (
                            <Button
                              variant={synced ? 'ghost' : 'default'}
                              size="sm"
                              onClick={() => handleSync(row)}
                              disabled={syncingId === row.id}
                            >
                              {syncingId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <><RefreshCw className="h-4 w-4 mr-1" /> {synced ? 'Ressincronizar' : 'Sincronizar'}</>
                              )}
                            </Button>
                          )}
                          {row.edit_path && (
                            <Button asChild variant="ghost" size="sm">
                              <Link to={row.edit_path}>Editar</Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/10 p-4">
                          <AbTestBox row={row} test={test} onChanged={refetchTests} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminSalesPages;
