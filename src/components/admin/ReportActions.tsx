import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, BookOpen, ShoppingCart, MessageSquare, Wifi, WifiOff, Mail, LayoutList, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ReportMetrics {
  welcome_queue?: { pendentes_sem_credenciais?: number; travados_mais_72h?: number };
  whatsapp?: { conexoes_offline?: number; fila_falhas?: number; fila_processing?: number; conversas_abertas?: number };
  [key: string]: unknown;
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isPending?: boolean;
  badge?: number;
  disabled?: boolean;
  disabledReason?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, icon, onClick, isPending, badge, disabled, disabledReason }) => {
  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isPending}
      className="relative gap-2"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
      {badge != null && badge > 0 && (
        <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
          {badge}
        </Badge>
      )}
    </Button>
  );

  if (disabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent><p>{disabledReason}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return btn;
};

const useEdgeFunctionAction = (fnName: string, body?: Record<string, unknown>) => {
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke(fnName, { body: body ?? {} });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => toast.success(`${fnName} executado com sucesso!`),
    onError: (err: Error) => {
      console.error(`Error invoking ${fnName}:`, err);
      toast.error(`Erro ao executar ${fnName}.`);
    },
  });
};

const ReportActions: React.FC<{ metrics: ReportMetrics }> = ({ metrics }) => {
  const navigate = useNavigate();
  const wq = metrics?.welcome_queue;
  const wa = metrics?.whatsapp;

  const onboarding = useEdgeFunctionAction('send-onboarding-reminders', { forceRun: true });
  const study = useMutation({
    mutationFn: async () => {
      let offset = 0;
      let batchNum = 0;
      let totalInactive = 0;
      const totals = { push: 0, emails: 0, whatsapp: 0 };

      while (true) {
        batchNum++;
        const res = await supabase.functions.invoke('send-study-reminders', {
          body: { forceRun: true, processOffset: offset },
        });
        if (res.error) throw res.error;
        const data = res.data;
        if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

        totalInactive = data.totalInactive ?? totalInactive;
        totals.push += data.pushSent ?? 0;
        totals.emails += data.emailsSent ?? 0;
        totals.whatsapp += data.whatsappQueued ?? 0;

        if (data.hasMore) {
          const totalBatches = Math.ceil(totalInactive / (data.batchProcessed || 100));
          toast.info(`Reforço Estudo: lote ${batchNum}/${totalBatches}...`);
          offset = data.nextOffset;
        } else {
          break;
        }
      }

      return { totalInactive, ...totals };
    },
    onSuccess: (data) => {
      toast.success(`Reforço Estudo concluído: ${data.push} push, ${data.emails} email(s), ${data.whatsapp} WhatsApp para ${data.totalInactive} aluno(s)`);
    },
    onError: (err: Error) => {
      console.error('Error invoking send-study-reminders:', err);
      toast.error('Erro ao executar Reforço Estudo.');
    },
  });
  const upsell = useEdgeFunctionAction('process-upsell');
  const queue = useEdgeFunctionAction('whatsapp-queue-processor');
  const retryMessages = useMutation({
    mutationFn: async () => {
      // Step 1: Fix stuck upsell sequences
      const fixRes = await supabase.functions.invoke('retry-failed-messages', {
        body: { action: 'fix_upsell_stuck' },
      });
      if (fixRes.error) throw fixRes.error;
      const fixData = fixRes.data;

      // Step 2: Queue failed messages for retry
      let totalQueued = 0;
      let hasMore = true;
      while (hasMore) {
        const retryRes = await supabase.functions.invoke('retry-failed-messages', {
          body: { action: 'retry_131042' },
        });
        if (retryRes.error) throw retryRes.error;
        totalQueued += retryRes.data?.queued || 0;
        hasMore = retryRes.data?.hasMore || false;
        if (hasMore) {
          toast.info(`Reenvio em lote: ${totalQueued} enfileirados...`);
        }
      }

      return { fixed: fixData?.fixed || 0, queued: totalQueued };
    },
    onSuccess: (data) => {
      toast.success(`Correção concluída: ${data.fixed} sequências corrigidas, ${data.queued} mensagens reenfileiradas`);
    },
    onError: (err: Error) => {
      console.error('Error retrying failed messages:', err);
      toast.error('Erro ao reenviar mensagens com falha.');
    },
  });

  const pendentesBoasVindas = (wq?.pendentes_sem_credenciais ?? 0) + (wq?.travados_mais_72h ?? 0);
  const filaFalhas = wa?.fila_falhas ?? 0;
  const filaProcessing = wa?.fila_processing ?? 0;
  const conexoesOffline = wa?.conexoes_offline ?? 0;
  const conversasAbertas = wa?.conversas_abertas ?? 0;

  const showQueueProcessor = filaFalhas > 0 || filaProcessing > 0;
  const showBoasVindas = pendentesBoasVindas > 0;
  const showConexoes = conexoesOffline > 0;
  const showFilaEnvios = filaFalhas > 0;
  const showConversas = conversasAbertas > 0;

  const hasNavButtons = showBoasVindas || showConexoes || showFilaEnvios || showConversas;

  return (
    <div className="mt-4 border-t pt-4 space-y-3">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">⚡ Ações Rápidas</p>

      {/* Execution buttons */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Disparos</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="Reforço Onboarding" icon={<Send className="h-4 w-4" />} onClick={() => onboarding.mutate()} isPending={onboarding.isPending} />
          <ActionButton label="Reforço Estudo" icon={<BookOpen className="h-4 w-4" />} onClick={() => study.mutate()} isPending={study.isPending} />
          <ActionButton label="Processar Upsell" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => upsell.mutate()} isPending={upsell.isPending} />
          {showQueueProcessor && (
            <ActionButton label="Processar Fila WhatsApp" icon={<MessageSquare className="h-4 w-4" />} onClick={() => queue.mutate()} isPending={queue.isPending} badge={filaFalhas + filaProcessing} />
          )}
          <ActionButton label="Retry 131042 + Fix Upsell" icon={<RefreshCw className="h-4 w-4" />} onClick={() => retryMessages.mutate()} isPending={retryMessages.isPending} />
        </div>
      </div>

      {/* Navigation buttons */}
      {(hasNavButtons || true) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Monitoramento</p>
          <div className="flex flex-wrap gap-2">
            {showBoasVindas && (
              <ActionButton label="Fila Boas-Vindas" icon={<Mail className="h-4 w-4" />} onClick={() => navigate('/admin/whatsapp')} badge={pendentesBoasVindas} />
            )}
            {showConexoes && (
              <ActionButton label="Conexões Offline" icon={<WifiOff className="h-4 w-4" />} onClick={() => navigate('/admin/whatsapp/conexoes')} badge={conexoesOffline} />
            )}
            {showFilaEnvios && (
              <ActionButton label="Fila de Envios" icon={<MessageSquare className="h-4 w-4" />} onClick={() => navigate('/admin/whatsapp/fila')} badge={filaFalhas} />
            )}
            {showConversas && (
              <ActionButton label="Conversas Abertas" icon={<MessageSquare className="h-4 w-4" />} onClick={() => navigate('/admin/whatsapp')} badge={conversasAbertas} />
            )}
            <ActionButton label="Gerenciar Templates" icon={<LayoutList className="h-4 w-4" />} onClick={() => navigate('/admin/whatsapp/associacoes')} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportActions;
