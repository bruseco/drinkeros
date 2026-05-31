import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { useClubeSettings } from '@/hooks/useClubeSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, ExternalLink, Copy, ChevronRight, FlaskConical, Loader2,
  Play, Pause, Trophy, Trash2,
} from 'lucide-react';

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

interface ProductInfo {
  productKey: string;
  name: string;
  originalPath: string;
  pageKeyA: string;
  pageKeyB: string;
  defaultVariantPath: string;
  backPath: string;
}

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

const useProductInfo = (productKey: string): ProductInfo | null => {
  const { data: courses = [] } = useCourses();
  const { data: ebooks = [] } = useEbooks();

  if (productKey === 'clube') {
    return {
      productKey,
      name: 'Clube dos Drinkeros',
      originalPath: '/clube',
      pageKeyA: 'clube',
      pageKeyB: 'clube-b',
      defaultVariantPath: '/clube-b',
      backPath: '/admin/paginas-venda',
    };
  }
  if (productKey.startsWith('course:')) {
    const id = productKey.slice('course:'.length);
    const c = courses.find((x: any) => x.id === id);
    if (!c) return null;
    return {
      productKey,
      name: c.name,
      originalPath: `/${c.slug}`,
      pageKeyA: productKey,
      pageKeyB: `${productKey}-b`,
      defaultVariantPath: `/${c.slug}-b`,
      backPath: '/admin/paginas-venda',
    };
  }
  if (productKey.startsWith('ebook:')) {
    const id = productKey.slice('ebook:'.length);
    const e = ebooks.find((x: any) => x.id === id);
    if (!e) return null;
    return {
      productKey,
      name: e.name,
      originalPath: `/${e.slug}`,
      pageKeyA: productKey,
      pageKeyB: `${productKey}-b`,
      defaultVariantPath: `/${e.slug}-b`,
      backPath: '/admin/paginas-venda',
    };
  }
  return null;
};

const AdminSalesProduct: React.FC = () => {
  const { productKey: raw } = useParams<{ productKey: string }>();
  const productKey = decodeURIComponent(raw ?? '');
  const info = useProductInfo(productKey);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useClubeSettings(); // pre-load for child queries

  const { data: test, refetch: refetchTest } = useQuery({
    queryKey: ['ab-test-detail', productKey],
    enabled: !!productKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('ab_tests' as any)
        .select('*')
        .eq('page_key', productKey)
        .maybeSingle();
      return (data as any) as AbTest | null;
    },
    refetchInterval: 30_000,
  });

  const [variantPath, setVariantPath] = useState('');
  const [split, setSplit] = useState(50);
  const [busy, setBusy] = useState(false);

  // Sincroniza estado local com o teste vindo do backend.
  React.useEffect(() => {
    if (test) {
      setVariantPath(test.variant_path);
      setSplit(test.traffic_split_pct);
    } else if (info) {
      setVariantPath(info.defaultVariantPath);
    }
  }, [test, info]);

  if (!info) {
    return (
      <div className="space-y-4">
        <Link to="/admin/paginas-venda" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Produto não encontrado.
        </div>
      </div>
    );
  }

  type PageRow = {
    label: string;
    path: string;
    pageKey: string;
    variant: 'a' | 'b';
    visits: number;
    conversions: number;
    isWinner: boolean;
  };
  const pages = useMemo<PageRow[]>(() => {
    const base: PageRow[] = [{
      label: 'Variante A (original)',
      path: info.originalPath,
      pageKey: info.pageKeyA,
      variant: 'a',
      visits: test?.visits_a ?? 0,
      conversions: test?.conversions_a ?? 0,
      isWinner: test?.winner === 'a',
    }];
    if (test) {
      base.push({
        label: 'Variante B',
        path: test.variant_path,
        pageKey: info.pageKeyB,
        variant: 'b',
        visits: test.visits_b,
        conversions: test.conversions_b,
        isWinner: test.winner === 'b',
      });
    }
    return base;
  }, [test, info]);

  const copyLink = (path: string) => {
    navigator.clipboard.writeText(`${ORIGIN}${path}`);
    toast({ title: 'Link copiado!', description: `${ORIGIN}${path}` });
  };

  const activate = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from('ab_tests' as any).upsert(
        {
          page_key: productKey,
          page_label: info.name,
          original_path: info.originalPath,
          variant_path: variantPath,
          traffic_split_pct: split,
          status: 'active',
          winner: null,
        },
        { onConflict: 'page_key' },
      );
      if (error) throw error;
      toast({ title: 'Teste A/B ativado!', description: `Variante: ${variantPath}` });
      refetchTest();
      queryClient.invalidateQueries({ queryKey: ['admin-ab-tests-min'] });
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
    refetchTest();
  };

  const togglePause = async () => {
    if (!test) return;
    const next = test.status === 'active' ? 'paused' : 'active';
    await supabase.from('ab_tests' as any).update({ status: next }).eq('id', test.id);
    toast({ title: next === 'active' ? 'Teste retomado' : 'Teste pausado' });
    refetchTest();
  };

  const declareWinner = async (winner: 'a' | 'b') => {
    if (!test) return;
    if (!confirm(`Definir ${winner.toUpperCase()} como vencedor? 100% do tráfego vai pra essa variante.`)) return;
    await supabase.from('ab_tests' as any).update({
      status: 'finished',
      winner,
      finished_at: new Date().toISOString(),
    }).eq('id', test.id);
    toast({ title: `Vencedor: ${winner.toUpperCase()}` });
    refetchTest();
  };

  const remove = async () => {
    if (!test) return;
    if (!confirm('Encerrar e remover este teste A/B?')) return;
    await supabase.from('ab_tests' as any).delete().eq('id', test.id);
    toast({ title: 'Teste removido' });
    refetchTest();
    queryClient.invalidateQueries({ queryKey: ['admin-ab-tests-min'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to={info.backPath} className="text-sm text-primary inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="h-3 w-3" /> Todos os produtos
        </Link>
        <h1 className="text-3xl font-bold text-foreground">{info.name}</h1>
        <p className="text-muted-foreground">Páginas e variantes A/B deste produto. Clique numa página para ver o funil.</p>
      </div>

      <div className="rounded-lg border divide-y">
        {pages.map((pg) => (
          <Link
            key={pg.pageKey}
            to={`/admin/paginas-venda/${encodeURIComponent(productKey)}/${encodeURIComponent(pg.pageKey)}`}
            className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30 transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Badge
                variant={pg.variant === 'a' ? 'outline' : 'default'}
                className={pg.variant === 'b' ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/15' : ''}
              >
                {pg.variant.toUpperCase()}
              </Badge>
              <div className="min-w-0">
                <div className="font-medium truncate">{pg.label}</div>
                <div className="text-xs text-muted-foreground truncate">{pg.path}</div>
              </div>
              {pg.isWinner && (
                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                  <Trophy className="h-3 w-3 mr-1" /> Vencedora
                </Badge>
              )}
              {test?.status === 'active' && !test.winner && (
                <Badge variant="outline" className="text-xs">
                  {pg.variant === 'a' ? 100 - test.traffic_split_pct : test.traffic_split_pct}% tráfego
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                <span>{pg.visits.toLocaleString('pt-BR')} visitas</span>
                <span>{pg.conversions.toLocaleString('pt-BR')} checkouts</span>
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyLink(pg.path); }}>
                <Copy className="h-4 w-4" />
              </Button>
              <a
                href={pg.path}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
            </div>
          </Link>
        ))}
      </div>

      {/* Painel de controle do teste A/B */}
      <div className="rounded-lg border bg-muted/20 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Teste A/B</h2>
          {test && (
            <Badge variant={test.status === 'active' ? 'default' : 'secondary'}>
              {test.status === 'active' ? 'Ativo' : test.status === 'paused' ? 'Pausado' : 'Encerrado'}
            </Badge>
          )}
        </div>

        {!test ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure uma variante B pra começar um teste A/B com split de tráfego.
            </p>
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
          </div>
        ) : (
          <div className="space-y-3">
            {test.status === 'active' && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Distribuição: A={100 - split}% · B={split}%
                </label>
                <Slider value={[split]} onValueChange={(v) => setSplit(v[0])} onValueCommit={(v) => updateSplit(v[0])} max={100} step={5} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {test.status !== 'finished' && (
                <Button size="sm" variant="outline" onClick={togglePause}>
                  {test.status === 'active' ? <><Pause className="h-3 w-3 mr-1" /> Pausar</> : <><Play className="h-3 w-3 mr-1" /> Retomar</>}
                </Button>
              )}
              {test.status === 'active' && !test.winner && (
                <>
                  <Button size="sm" variant="outline" onClick={() => declareWinner('a')}>
                    <Trophy className="h-3 w-3 mr-1" /> A vencedor
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => declareWinner('b')}>
                    <Trophy className="h-3 w-3 mr-1" /> B vencedor
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={remove}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSalesProduct;
