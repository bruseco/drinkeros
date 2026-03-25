import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EVENT_TYPES = [
  { value: 'all', label: 'Todos' },
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'onboarding_followup', label: 'Onboarding' },
  { value: 'onboarding_reminder', label: 'Lembrete Onboarding' },
  { value: 'study_reminder', label: 'Reforço Estudo' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'whatsapp_agent', label: 'Agente IA' },
];

const CHANNELS = [
  { value: 'all', label: 'Todos' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push' },
];

const PAGE_SIZE = 50;

const eventTypeColors: Record<string, string> = {
  welcome: 'bg-green-500/20 text-green-400 border-green-500/30',
  onboarding_followup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  onboarding_reminder: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  study_reminder: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  upsell: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  whatsapp_agent: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const subtypeColors: Record<string, string> = {
  sent: 'bg-green-500/20 text-green-400',
  queued: 'bg-yellow-500/20 text-yellow-400',
  failed: 'bg-red-500/20 text-red-400',
  escalated: 'bg-orange-500/20 text-orange-400',
  responded: 'bg-blue-500/20 text-blue-400',
};

export default function AdminCSTimeline() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('all');
  const [channel, setChannel] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['cs-timeline', page, search, eventType, channel],
    queryFn: async () => {
      let query = supabase
        .from('cs_timeline_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (eventType !== 'all') {
        query = query.eq('event_type', eventType);
      }
      if (channel !== 'all') {
        query = query.eq('channel', channel);
      }
      if (search.trim()) {
        query = query.or(`phone.ilike.%${search}%,summary.ilike.%${search}%`);
      }

      const { data: events, count, error } = await query;
      if (error) throw error;
      return { events: events || [], count: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Timeline do Agente CS</h1>
        <Badge variant="outline" className="ml-auto">
          {data?.count || 0} eventos
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone ou descrição..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={eventType} onValueChange={(v) => { setEventType(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Data/Hora</TableHead>
                <TableHead className="w-[140px]">Tipo</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[80px]">Canal</TableHead>
                <TableHead className="w-[130px]">Telefone</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : data?.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum evento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data?.events.map((event: any) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${eventTypeColors[event.event_type] || ''}`}>
                        {EVENT_TYPES.find((t) => t.value === event.event_type)?.label || event.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${subtypeColors[event.event_subtype] || ''}`}>
                        {event.event_subtype}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{event.channel}</span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {event.phone || '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">
                      {event.summary}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
