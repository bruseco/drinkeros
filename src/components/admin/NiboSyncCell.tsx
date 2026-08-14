import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock, FileWarning } from 'lucide-react';

interface Props {
  orderId: string;
}

interface SyncRow {
  status: string;
  last_error: string | null;
  nibo_invoice_id: string | null;
  nibo_schedule_id: string | null;
  nibo_customer_id: string | null;
}

export const NiboSyncCell = ({ orderId }: Props) => {
  const [row, setRow] = useState<SyncRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchRow = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nibo_sync_log' as any)
      .select('status, last_error, nibo_invoice_id, nibo_schedule_id, nibo_customer_id')
      .eq('order_id', orderId)
      .maybeSingle();
    setRow((data as unknown as SyncRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => { fetchRow(); }, [orderId]);

  const send = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('nibo-sync-payment', {
        body: { order_id: orderId },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      if (result?.ok) {
        toast({ title: 'Enviado para o NIBO', description: 'Cliente, receita e NF criados com sucesso.' });
      } else {
        toast({
          title: 'Falha parcial no envio',
          description: result?.error || 'Verifique o log no banco para detalhes.',
          variant: 'destructive',
        });
      }
      await fetchRow();
    } catch (e) {
      toast({
        title: 'Erro ao enviar para NIBO',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (row?.status === 'success') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" /> NIBO
        </Badge>
        <Button size="icon" variant="ghost" onClick={send} disabled={sending} title="Reenviar">
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>
    );
  }

  if (row?.status === 'partial' || row?.status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1" title={row.last_error || ''}>
          <AlertCircle className="h-3 w-3" /> Falha
        </Badge>
        <Button size="sm" variant="outline" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Tentar de novo'}
        </Button>
      </div>
    );
  }

  if (row?.status === 'pending_fiscal') {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
          title={row.last_error || 'O cliente ainda não preencheu o endereço fiscal.'}
        >
          <FileWarning className="h-3 w-3" /> Dados pendentes
        </Badge>
        <Button size="sm" variant="outline" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Tentar de novo'}
        </Button>
      </div>
    );
  }

  if (row?.status === 'pending') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> Em fila
      </Badge>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={send} disabled={sending}>
      {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
      Enviar p/ NIBO
    </Button>
  );
};
