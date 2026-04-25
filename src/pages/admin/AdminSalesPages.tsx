import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, ExternalLink, Copy, RefreshCw, BookOpen, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

interface SaleRow {
  id: string;
  name: string;
  slug: string;
  cover: string | null;
  price: number | null;
  is_available_for_sale: boolean;
  stripe_price_id: string | null;
  type: 'course' | 'ebook';
}

const AdminSalesPages: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: ebooks = [], isLoading: ebooksLoading } = useEbooks();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const isLoading = coursesLoading || ebooksLoading;

  const rows: SaleRow[] = [
    ...courses.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      cover: c.cover_image_url,
      price: c.price ? Number(c.price) : null,
      is_available_for_sale: c.is_available_for_sale,
      stripe_price_id: c.stripe_price_id ?? null,
      type: 'course' as const,
    })),
    ...ebooks.map((e: any) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      cover: e.cover_image_url,
      price: e.price ? Number(e.price) : null,
      is_available_for_sale: e.is_active,
      stripe_price_id: e.stripe_price_id ?? null,
      type: 'ebook' as const,
    })),
  ];

  const handleCopyLink = (slug: string) => {
    const url = `${ORIGIN}/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!', description: url });
  };

  const handleSync = async (row: SaleRow) => {
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
          Cada curso ou e-book tem uma página de venda automática em <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{ORIGIN}/&lt;slug&gt;</code>.
          Sincronize com Stripe para habilitar o checkout.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Nenhum curso ou e-book cadastrado ainda.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>Link público</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const url = `${ORIGIN}/${row.slug}`;
                const synced = !!row.stripe_price_id;
                return (
                  <TableRow key={`${row.type}-${row.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {row.cover ? (
                          <img src={row.cover} alt={row.name} className="h-10 w-16 rounded-md object-cover" />
                        ) : (
                          <div className="h-10 w-16 rounded-md bg-muted flex items-center justify-center">
                            {row.type === 'course' ? <BookOpen className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">{row.name}</span>
                          {!row.is_available_for_sale && (
                            <Badge variant="secondary" className="ml-2 text-xs">Indisponível</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.type === 'course' ? 'Curso' : 'E-book'}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.price ? (
                        <span className="text-sm font-medium">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.price)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {synced ? (
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
                        /{row.slug}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleCopyLink(row.slug)}>
                          <Copy className="h-4 w-4 mr-1" /> Copiar
                        </Button>
                        <Button
                          variant={synced ? 'ghost' : 'default'}
                          size="sm"
                          onClick={() => handleSync(row)}
                          disabled={syncingId === row.id}
                        >
                          {syncingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><RefreshCw className="h-4 w-4 mr-1" /> {synced ? 'Ressincronizar' : 'Sincronizar Stripe'}</>
                          )}
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={row.type === 'course' ? `/admin/cursos/${row.id}` : `/admin/ebooks/${row.id}`}>
                            Editar
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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
