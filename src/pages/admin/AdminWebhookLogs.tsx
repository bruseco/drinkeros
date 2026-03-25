import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Search, Eye, CheckCircle2, XCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, Copy, Check, Webhook, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

interface WebhookLog {
  id: string;
  created_at: string;
  source: string;
  product_id: string | null;
  product_name: string | null;
  email: string | null;
  phone: string | null;
  user_name: string | null;
  status: string;
  status_detail: string | null;
  user_id: string | null;
  is_new_user: boolean | null;
  already_had_access: boolean | null;
  raw_payload: any;
  error_message: string | null;
  processing_time_ms: number | null;
}

const PAGE_SIZE = 50;

const AdminWebhookLogs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['webhook-logs', debouncedSearch, statusFilter, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('webhook_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (debouncedSearch) {
        query = query.or(`email.ilike.%${debouncedSearch}%,user_name.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,product_id.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as WebhookLog[], totalCount: count || 0 };
    },
  });

  // Separate query for global stats (unaffected by pagination)
  const { data: stats } = useQuery({
    queryKey: ['webhook-logs-stats', debouncedSearch, statusFilter],
    queryFn: async () => {
      // Get total count
      let totalQuery = supabase.from('webhook_logs').select('*', { count: 'exact', head: true });
      if (debouncedSearch) {
        totalQuery = totalQuery.or(`email.ilike.%${debouncedSearch}%,user_name.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,product_id.ilike.%${debouncedSearch}%`);
      }
      const { count: total } = await totalQuery;

      // Get success count
      let successQuery = supabase.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'success');
      if (debouncedSearch) {
        successQuery = successQuery.or(`email.ilike.%${debouncedSearch}%,user_name.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,product_id.ilike.%${debouncedSearch}%`);
      }
      const { count: successCount } = await successQuery;

      // Get error count
      let errorQuery = supabase.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'error');
      if (debouncedSearch) {
        errorQuery = errorQuery.or(`email.ilike.%${debouncedSearch}%,user_name.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%,product_id.ilike.%${debouncedSearch}%`);
      }
      const { count: errorCount } = await errorQuery;

      return { total: total || 0, successCount: successCount || 0, errorCount: errorCount || 0 };
    },
  });

  const logs = data?.logs;
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground">Logs de webhooks recebidos e referência de endpoints</p>
        </div>
      </div>

      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="logs" className="gap-2"><Clock className="h-4 w-4" /> Logs</TabsTrigger>
          <TabsTrigger value="reference" className="gap-2"><BookOpen className="h-4 w-4" /> Referência</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-600/10">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sucesso</p>
                    <p className="text-2xl font-bold text-green-500">{stats?.successCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Erros</p>
                    <p className="text-2xl font-bold text-destructive">{stats?.errorCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email, nome, produto ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="hidden md:table-cell">ID WooCommerce</TableHead>
                    <TableHead className="hidden lg:table-cell">Tempo</TableHead>
                    <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : !logs?.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{log.email || '-'}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm font-medium">{log.product_name || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{log.product_id || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {log.processing_time_ms ? `${log.processing_time_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {log.is_new_user ? (
                            <Badge variant="outline" className="text-xs">Novo</Badge>
                          ) : log.already_had_access ? (
                            <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">Reenvio</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Existente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <LogDetailDialog log={log} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reference" className="space-y-6">
          <WebhookReference />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const BASE_URL = `https://ohgfkqxdpipgtokzlpfv.supabase.co/functions/v1`;

const WEBHOOKS = [
  {
    name: 'Matrícula WooCommerce',
    endpoint: 'woocommerce-webhook',
    method: 'POST',
    description: 'Recebe eventos de compra do WooCommerce e cria/atualiza matrículas automaticamente.',
    payload: {
      email: 'aluno@email.com',
      first_name: 'João',
      last_name: 'Silva',
      phone: '5511999999999',
      product_id: '123',
      product_name: 'Curso Penal',
      order_id: '4567',
      status: 'completed',
    },
  },
  {
    name: 'CRM — Matrícula',
    endpoint: 'woocommerce-crm-webhook',
    method: 'POST',
    description: 'Cria lead no CRM após matrícula (usado internamente pelo woocommerce-webhook).',
    payload: {
      email: 'aluno@email.com',
      nome: 'João Silva',
      telefone: '5511999999999',
      id: '123',
      produto: 'Curso Penal',
      valor: '297.00',
      order_id: '4567',
      status: 'completed',
    },
  },
  {
    name: 'CRM — Carrinho Abandonado',
    endpoint: 'crm-webhook-carrinho',
    method: 'POST',
    description: 'Cria lead com estágio "carrinho_abandonado_1". Se o lead já existir, escala para carrinho_abandonado_2. Aceita nomes de produtos separados por vírgula.',
    payload: {
      email: 'lead@email.com',
      nome: 'Maria Souza',
      telefone: '5511988888888',
      produto: 'Curso Penal, Módulo Processo Penal',
      valor: '297.00',
      recovery_url: 'https://loja.com/checkout/order-received/123',
    },
  },
  {
    name: 'CRM — PIX Não Pago',
    endpoint: 'crm-webhook-pix',
    method: 'POST',
    description: 'Cria lead com estágio "pix_nao_pago_1". Se o lead já existir, escala para pix_nao_pago_2.',
    payload: {
      email: 'lead@email.com',
      nome: 'Carlos Lima',
      telefone: '5521977777777',
      id: '123',
      produto: 'Combo Completo',
      valor: '497.00',
      recovery_url: 'https://loja.com/checkout/order-received/456',
      order_id: '7890',
    },
  },
  {
    name: 'CRM — Cartão Recusado',
    endpoint: 'crm-webhook-cartao',
    method: 'POST',
    description: 'Cria lead com estágio "cartao_recusado".',
    payload: {
      email: 'lead@email.com',
      nome: 'Ana Oliveira',
      telefone: '5531966666666',
      id: '123',
      produto: 'Módulo Processo Penal',
      valor: '197.00',
      recovery_url: 'https://loja.com/checkout/order-received/789',
      order_id: '1011',
    },
  },
  {
    name: 'CRM — Pico de Vendas',
    endpoint: 'crm-webhook-pico-vendas',
    method: 'POST',
    description: 'Cria lead no funil "Pico de Vendas" com estágio "entrada_contato". Deduplica por email/phone. Campo "name" é obrigatório.',
    payload: {
      name: 'Pedro Santos',
      email: 'pedro@email.com',
      phone: '5511999999999',
      product_name: 'Curso Penal',
      sale_value: 197,
    },
  },
];

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
};

const WebhookReference: React.FC = () => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Todos os webhooks aceitam <Badge variant="outline" className="text-xs">POST</Badge> com JSON ou form-urlencoded. 
        O campo <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">email</code> é obrigatório em todos.
      </p>

      {WEBHOOKS.map((wh) => {
        const fullUrl = `${BASE_URL}/${wh.endpoint}`;
        const payloadStr = JSON.stringify(wh.payload, null, 2);
        const curlCmd = `curl -X POST '${fullUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(wh.payload)}'`;

        return (
          <Card key={wh.endpoint}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-primary" />
                    {wh.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{wh.description}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">{wh.method}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* URL */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">URL do Endpoint</p>
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                  <code className="text-xs font-mono break-all flex-1">{fullUrl}</code>
                  <CopyButton text={fullUrl} />
                </div>
              </div>

              {/* Payload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">Payload de Exemplo</p>
                  <CopyButton text={payloadStr} />
                </div>
                <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto whitespace-pre-wrap break-all max-h-[200px]">
                  {payloadStr}
                </pre>
              </div>

              {/* cURL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">cURL</p>
                  <CopyButton text={curlCmd} />
                </div>
                <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto whitespace-pre-wrap break-all max-h-[120px]">
                  {curlCmd}
                </pre>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const LogDetailDialog: React.FC<{ log: WebhookLog }> = ({ log }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon">
        <Eye className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Detalhes do Webhook</DialogTitle>
      </DialogHeader>
      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Data/Hora</p>
              <p className="font-medium">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{log.status === 'success' ? '✅ Sucesso' : '❌ Erro'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{log.email || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Nome</p>
              <p className="font-medium">{log.user_name || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Telefone</p>
              <p className="font-medium">{log.phone || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Produto</p>
              <p className="font-medium">{log.product_name || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ID WooCommerce</p>
              <p className="font-medium">{log.product_id || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tempo de processamento</p>
              <p className="font-medium">{log.processing_time_ms ? `${log.processing_time_ms}ms` : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Novo usuário?</p>
              <p className="font-medium">{log.is_new_user ? 'Sim' : 'Não'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Já tinha acesso?</p>
              <p className="font-medium">{log.already_had_access ? 'Sim' : 'Não'}</p>
            </div>
          </div>

          {log.status_detail && (
            <div>
              <p className="text-muted-foreground mb-1">Detalhes</p>
              <p className="bg-muted p-3 rounded-lg">{log.status_detail}</p>
            </div>
          )}

          {log.error_message && (
            <div>
              <p className="text-muted-foreground mb-1">Erro</p>
              <p className="bg-destructive/10 text-destructive p-3 rounded-lg break-all">{log.error_message}</p>
            </div>
          )}

          {log.raw_payload && (
            <div>
              <p className="text-muted-foreground mb-1">Payload Raw</p>
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.raw_payload, null, 2)}
              </pre>
            </div>
          )}

          {log.user_id && (
            <div>
              <p className="text-muted-foreground mb-1">User ID</p>
              <p className="font-mono text-xs bg-muted p-2 rounded">{log.user_id}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
);

export default AdminWebhookLogs;