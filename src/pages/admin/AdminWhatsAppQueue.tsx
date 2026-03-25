import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Search, Clock, CheckCircle2, XCircle, Loader2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type QueueStatus = 'all' | 'pending' | 'processing' | 'sent' | 'failed';

const PAGE_SIZE = 50;

const AdminWhatsAppQueue: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<QueueStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  // Main paginated query
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['whatsapp-queue', statusFilter, search, page],
    queryFn: async () => {
      const offset = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from('whatsapp_send_queue')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (search.trim()) query = query.or(`phone.ilike.%${search.trim()}%,message.ilike.%${search.trim()}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: data || [], total: count ?? 0 };
    },
    refetchInterval: 15000,
  });

  // Separate count queries for real stats
  const { data: statsData } = useQuery({
    queryKey: ['whatsapp-queue-stats'],
    queryFn: async () => {
      const [pending, processing, sent, failed] = await Promise.all([
        supabase.from('whatsapp_send_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('whatsapp_send_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('whatsapp_send_queue').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('whatsapp_send_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      ]);
      return {
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        sent: sent.count ?? 0,
        failed: failed.count ?? 0,
      };
    },
    refetchInterval: 15000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRecord = Math.min(page * PAGE_SIZE, total);

  const stats = statsData ?? { pending: 0, processing: 0, sent: 0, failed: 0 };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case 'sent':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const contextBadge = (type: string) => {
    switch (type) {
      case 'upsell':
        return <Badge className="bg-purple-600 text-white text-[10px]">Upsell</Badge>;
      case 'welcome':
        return <Badge className="bg-emerald-600 text-white text-[10px]">Boas-vindas</Badge>;
      case 'reminder':
        return <Badge className="bg-amber-600 text-white text-[10px]">Lembrete</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{type}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/whatsapp">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fila de WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Mensagens aguardando envio pela fila anti-ban</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-xs text-muted-foreground">Processando</p>
          <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
        </div>
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-xs text-muted-foreground">Enviados</p>
          <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
        </div>
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-xs text-muted-foreground">Falhas</p>
          <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as QueueStatus)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="processing">Processando</TabsTrigger>
            <TabsTrigger value="sent">Enviados</TabsTrigger>
            <TabsTrigger value="failed">Falhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar telefone ou mensagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Tipo</TableHead>
              <TableHead className="w-[130px]">Telefone</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="w-[70px]">Tentativas</TableHead>
              <TableHead className="w-[100px]">Agendado</TableHead>
              <TableHead className="w-[100px]">Enviado</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum item na fila
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell>{contextBadge(item.context_type)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.phone}</TableCell>
                  <TableCell className="max-w-[300px]">
                    {(() => {
                      try {
                        const parsed = JSON.parse(item.message);
                        if (parsed?.type === 'template' && parsed?.template_name) {
                          const vars = parsed.variables || {};
                          const varEntries = Object.entries(vars).map(([k, v]) => `{{${k}}}=${v}`).join(', ');
                          return (
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-foreground">{parsed.template_name}</p>
                              {varEntries && <p className="text-[10px] text-muted-foreground truncate" title={varEntries}>{varEntries}</p>}
                            </div>
                          );
                        }
                      } catch { /* not JSON */ }
                      // CRM recovery / other: show context_data template info
                      const ctx = item.context_data as Record<string, any> | null;
                      if (ctx?.template_name) {
                        const vars = ctx.variables || ctx.template_variables || {};
                        const varEntries = Object.entries(vars).map(([k, v]) => `{{${k}}}=${v}`).join(', ');
                        return (
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-foreground">{ctx.template_name}</p>
                            {varEntries && <p className="text-[10px] text-muted-foreground truncate" title={varEntries}>{varEntries}</p>}
                          </div>
                        );
                      }
                      return <p className="text-xs truncate" title={item.message}>{item.message}</p>;
                    })()}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {item.attempts}/{item.max_attempts}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(item.scheduled_at)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.sent_at ? formatDate(item.sent_at) : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {item.error_message && (
                      <p className="text-xs text-destructive truncate" title={item.error_message}>
                        {item.error_message}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0
            ? 'Nenhum registro'
            : `Mostrando ${startRecord}–${endRecord} de ${total} registros`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="px-2">Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
          >
            Próxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminWhatsAppQueue;
