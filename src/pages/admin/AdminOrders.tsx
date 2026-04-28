import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';

const sourceLabel: Record<string, string> = {
  stripe: 'Stripe',
  mercadopago: 'Mercado Pago',
  woocommerce: 'WooCommerce',
  hotmart: 'Hotmart',
  pix: 'PIX',
};

const sourceVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  stripe: 'default',
  mercadopago: 'default',
  woocommerce: 'secondary',
  hotmart: 'secondary',
  pix: 'outline',
};

const productLabel: Record<string, string> = {
  curso: 'Curso',
  ebook: 'E-book',
  combo: 'Combo',
  pacote: 'Pacote',
  clube: 'Clube dos Drinkeros',
};

const fmtBRL = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const PAGE_SIZE = 50;

const AdminOrders: React.FC = () => {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>('all');
  const [productType, setProductType] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isFetching } = useAdminOrders({
    search: debouncedSearch,
    source: source === 'all' ? undefined : source,
    productType: productType === 'all' ? undefined : productType,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const totalRevenue = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const applyPreset = (preset: 'today' | '7d' | '30d' | 'mtd' | 'lastMonth' | 'ytd' | 'clear') => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setPage(0);
    if (preset === 'clear') { setFrom(''); setTo(''); return; }
    if (preset === 'today') {
      setFrom(fmt(now)); setTo(fmt(now)); return;
    }
    if (preset === '7d') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      setFrom(fmt(d)); setTo(fmt(now)); return;
    }
    if (preset === '30d') {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      setFrom(fmt(d)); setTo(fmt(now)); return;
    }
    if (preset === 'mtd') {
      setFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(fmt(now)); return;
    }
    if (preset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(fmt(start)); setTo(fmt(end)); return;
    }
    if (preset === 'ytd') {
      setFrom(fmt(new Date(now.getFullYear(), 0, 1)));
      setTo(fmt(now)); return;
    }
  };

  const presets: Array<{ key: Parameters<typeof applyPreset>[0]; label: string }> = [
    { key: 'today', label: 'Hoje' },
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'mtd', label: 'Mês vigente' },
    { key: 'lastMonth', label: 'Mês passado' },
    { key: 'ytd', label: 'Este ano' },
    { key: 'clear', label: 'Personalizado' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Histórico de vendas confirmadas (Stripe, Mercado Pago, WooCommerce, Hotmart e Pix)</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Vendas no filtro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total.toLocaleString('pt-BR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Receita (página atual)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmtBRL(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.key} variant="outline" size="sm" onClick={() => applyPreset(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone, produto ou ID externo..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                <SelectItem value="woocommerce">WooCommerce</SelectItem>
                <SelectItem value="hotmart">Hotmart</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productType} onValueChange={(v) => { setProductType(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="clube">Clube dos Drinkeros</SelectItem>
                <SelectItem value="curso">Cursos</SelectItem>
                <SelectItem value="ebook">E-books</SelectItem>
                <SelectItem value="combo">Combos</SelectItem>
                <SelectItem value="pacote">Pacotes (avulsos)</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Nenhuma venda encontrada para os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.purchased_at)}</TableCell>
                    <TableCell>
                      <Link to={`/admin/users/${r.user_id}`} className="hover:underline">
                        <div className="font-medium">{r.buyer_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.buyer_email}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.product_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{productLabel[r.product_type] || r.product_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sourceVariant[r.source] || 'outline'}>
                        {sourceLabel[r.source] || r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages} · {total.toLocaleString('pt-BR')} pedidos
            {isFetching && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
