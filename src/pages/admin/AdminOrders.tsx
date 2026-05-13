import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAdminOrders } from '@/hooks/useAdminOrders';
import { useAdminOrdersChart } from '@/hooks/useAdminOrdersChart';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
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
};

const sourceVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  stripe: 'default',
  mercadopago: 'secondary',
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

type PresetKey = 'today' | '7d' | '30d' | 'mtd' | 'lastMonth' | 'ytd' | 'clear';

const initialMtd = () => {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(now),
  };
};

const AdminOrders: React.FC = () => {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>('all');
  const [productType, setProductType] = useState<string>('all');
  const [from, setFrom] = useState<string>(() => initialMtd().from);
  const [to, setTo] = useState<string>(() => initialMtd().to);
  const [activePreset, setActivePreset] = useState<PresetKey>('mtd');
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

  const chartFilters = useMemo(() => ({
    search: debouncedSearch,
    source: source === 'all' ? undefined : source,
    productType: productType === 'all' ? undefined : productType,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  }), [debouncedSearch, source, productType, from, to]);

  const { data: chartResult, isLoading: chartLoading } = useAdminOrdersChart(chartFilters);
  const chartData = chartResult?.points ?? [];
  const chartTotalRevenue = chartResult?.totalRevenue ?? 0;
  const chartTotalCount = chartResult?.totalCount ?? 0;

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  

  const applyPreset = (preset: PresetKey) => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setPage(0);
    setActivePreset(preset);
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

  const presets: Array<{ key: PresetKey; label: string }> = [
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
          <p className="text-muted-foreground">Histórico de vendas confirmadas pelo Stripe e Mercado Pago</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Vendas no filtro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{chartTotalCount.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground mt-1">no período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Receita do período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmtBRL(chartTotalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">soma de todas as vendas no filtro</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Vendas por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-[120px] p-2">
            {chartLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Carregando...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem vendas no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name) => {
                      if (name === 'revenue') return [fmtBRL(value), 'Receita'];
                      return [value, 'Vendas'];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => {
              const isActive = activePreset === p.key;
              return (
                <Button
                  key={p.key}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset(p.key)}
                  className={isActive ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-transparent' : ''}
                >
                  {p.label}
                </Button>
              );
            })}
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
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); setActivePreset('clear'); }} />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); setActivePreset('clear'); }} />
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
                  <TableHead>NIBO</TableHead>
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
                    <TableCell><NiboSyncCell orderId={r.id} /></TableCell>
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
            Página {page + 1} de {totalPages} · {total.toLocaleString('pt-BR')} vendas
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
