import React from 'react';
import { Link } from 'react-router-dom';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { useClubeSettings } from '@/hooks/useClubeSettings';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Loader2, BookOpen, FileText, Crown, FlaskConical, ChevronRight, Layers,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ProductRow {
  productKey: string;          // ex: 'clube', 'course:<id>', 'ebook:<id>'
  name: string;
  cover: string | null;
  price: number | null;
  type: 'club' | 'course' | 'ebook';
  is_available_for_sale: boolean;
  pages: Array<{ path: string; pageKey: string; variant: 'a' | 'b' }>;
}

const formatBRL = (n: number | null) =>
  n
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
    : '—';

const AdminSalesPages: React.FC = () => {
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: ebooks = [], isLoading: ebooksLoading } = useEbooks();
  const { data: clubeSettings } = useClubeSettings();

  // Carrega ab_tests só pra contar variantes ativas por produto.
  const { data: tests = [] } = useQuery({
    queryKey: ['admin-ab-tests-min'],
    queryFn: async () => {
      const { data } = await supabase.from('ab_tests' as any).select('page_key, variant_path, status');
      return (data ?? []) as unknown as Array<{ page_key: string; variant_path: string; status: string }>;
    },
    refetchInterval: 60_000,
  });
  const testByKey = new Map(tests.map((t) => [t.page_key, t]));

  const isLoading = coursesLoading || ebooksLoading;

  const products: ProductRow[] = [
    {
      productKey: 'clube',
      name: 'Clube dos Drinkeros',
      cover: null,
      price: clubeSettings?.full_price ?? 197,
      type: 'club',
      is_available_for_sale: true,
      pages: [
        { path: '/pv-clube', pageKey: 'clube', variant: 'a' },
        ...(testByKey.get('clube')
          ? [{ path: testByKey.get('clube')!.variant_path, pageKey: 'clube-b', variant: 'b' as const }]
          : []),
      ],
    },
    ...courses.map((c: any): ProductRow => {
      const t = testByKey.get(`course:${c.id}`);
      return {
        productKey: `course:${c.id}`,
        name: c.name,
        cover: c.cover_image_url,
        price: c.price ? Number(c.price) : null,
        type: 'course',
        is_available_for_sale: c.is_available_for_sale,
        pages: [
          { path: `/${c.slug}`, pageKey: `course:${c.id}`, variant: 'a' },
          ...(t ? [{ path: t.variant_path, pageKey: `course:${c.id}-b`, variant: 'b' as const }] : []),
        ],
      };
    }),
    ...ebooks.map((e: any): ProductRow => {
      const t = testByKey.get(`ebook:${e.id}`);
      return {
        productKey: `ebook:${e.id}`,
        name: e.name,
        cover: e.cover_image_url,
        price: e.price ? Number(e.price) : null,
        type: 'ebook',
        is_available_for_sale: e.is_active,
        pages: [
          { path: `/${e.slug}`, pageKey: `ebook:${e.id}`, variant: 'a' },
          ...(t ? [{ path: t.variant_path, pageKey: `ebook:${e.id}-b`, variant: 'b' as const }] : []),
        ],
      };
    }),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Páginas de Venda</h1>
        <p className="text-muted-foreground">
          Selecione um produto para ver suas páginas, variantes A/B e funil de conversão.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const typeLabel = p.type === 'club' ? 'Assinatura' : 'Compra';
            const Icon = p.type === 'club' ? Crown : p.type === 'course' ? BookOpen : FileText;
            return (
              <Link
                key={p.productKey}
                to={`/admin/paginas-venda/${encodeURIComponent(p.productKey)}`}
                className="group"
              >
                <Card className="overflow-hidden hover:border-primary/60 transition h-full flex flex-col">
                  <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                    {p.cover ? (
                      <img src={p.cover} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="h-10 w-10 text-muted-foreground/60" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <Badge variant="outline" className="bg-background/80 backdrop-blur text-xs">
                        {typeLabel}
                      </Badge>
                      {!p.is_available_for_sale && (
                        <Badge variant="secondary" className="text-xs">Indisponível</Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
                    </div>
                    <div className="text-sm text-muted-foreground">{formatBRL(p.price)}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {p.pages.length} {p.pages.length === 1 ? 'página' : 'páginas'}
                      </span>
                      {p.pages.length > 1 && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <FlaskConical className="h-3 w-3" /> A/B
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSalesPages;
