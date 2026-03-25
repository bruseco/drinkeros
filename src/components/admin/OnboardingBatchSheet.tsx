import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { GraduationCap, RotateCcw, Loader2, AlertCircle, CheckCircle2, Users, ListOrdered, Send, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DryRunResult {
  total_eligible: number;
  sample: { user_id: string; name: string; phone: string; email: string }[];
}

interface QueueStats {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

const OnboardingBatchSheet: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [totalEligible, setTotalEligible] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [sample, setSample] = useState<DryRunResult['sample']>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [lastEnqueueResult, setLastEnqueueResult] = useState<{ queued: number; remaining: number } | null>(null);

  const loadQueueStats = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_send_queue')
      .select('status')
      .eq('context_type', 'onboarding_followup');

    if (error) {
      console.error('Error loading queue stats:', error);
      return;
    }

    const stats = { pending: 0, sent: 0, failed: 0, total: data?.length ?? 0 };
    for (const row of data ?? []) {
      if (row.status === 'pending' || row.status === 'processing') stats.pending++;
      else if (row.status === 'sent') stats.sent++;
      else if (row.status === 'failed') stats.failed++;
    }
    setQueueStats(stats);
  }, []);

  const runDryRun = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-onboarding-followup-batch', {
        body: { batch_size: 20, offset: 0, dry_run: true },
      });
      if (error) throw error;
      setTotalEligible(data.total_eligible);
      setSample(data.sample || []);
    } catch (err: any) {
      toast.error('Erro ao verificar elegíveis: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enqueueNow = useCallback(async () => {
    setIsEnqueuing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enqueue-onboarding-batch');
      if (error) throw error;

      setLastEnqueueResult({ queued: data.queued ?? 0, remaining: data.remaining ?? 0 });
      toast.success(`${data.queued} alunos enfileirados! Restam ${data.remaining}.`);

      // Reload stats
      await Promise.all([runDryRun(), loadQueueStats()]);
    } catch (err: any) {
      toast.error('Erro ao enfileirar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsEnqueuing(false);
    }
  }, [runDryRun, loadQueueStats]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setLastEnqueueResult(null);
      Promise.all([runDryRun(), loadQueueStats()]);
    }
  };

  const queueProgressPercent = queueStats && queueStats.total > 0
    ? Math.round((queueStats.sent / queueStats.total) * 100)
    : 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reforço de Onboarding">
          <GraduationCap className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Reforço de Onboarding
          </SheetTitle>
          <SheetDescription>
            Fila automática de WhatsApp para alunos sem acesso.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verificando alunos elegíveis...</span>
            </div>
          ) : (
            <>
              {/* Eligible count */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{totalEligible ?? '—'}</span>
                    <span className="text-sm text-muted-foreground">ainda elegíveis</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => Promise.all([runDryRun(), loadQueueStats()])} disabled={isLoading}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {sample.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Amostra:</p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {sample.map((s, i) => (
                        <div key={i} className="text-xs flex justify-between text-muted-foreground">
                          <span className="truncate max-w-[60%]">{s.name || s.email}</span>
                          <span className="font-mono text-[10px]">{s.phone}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Queue Status */}
              {queueStats !== null && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ListOrdered className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status da Fila</span>
                  </div>

                  {queueStats.total > 0 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-mono text-sm">{queueStats.sent}/{queueStats.total}</span>
                      </div>
                      <Progress value={queueProgressPercent} className="h-2" />
                      <div className="flex gap-3 text-xs flex-wrap">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3 text-warning" /> {queueStats.pending} aguardando
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-success" /> {queueStats.sent} enviados
                        </span>
                        {queueStats.failed > 0 && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <AlertCircle className="h-3 w-3 text-destructive" /> {queueStats.failed} falhas
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum item na fila ainda.</p>
                  )}
                </div>
              )}

              <Separator />

              {/* Enqueue Now Button */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Enfileira os próximos <strong>100 alunos</strong> com envio escalonado (100/hora, 08h–21h BRT). O cron automático já roda a cada 2h.
                </p>
                <Button
                  onClick={enqueueNow}
                  className="w-full"
                  disabled={isEnqueuing || totalEligible === 0}
                >
                  {isEnqueuing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enfileirando...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Enfileirar próximos 100 agora</>
                  )}
                </Button>

                {lastEnqueueResult && (
                  <div className="rounded-md bg-accent/30 border border-border p-3 text-sm">
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {lastEnqueueResult.queued} alunos enfileirados
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lastEnqueueResult.remaining > 0
                        ? `${lastEnqueueResult.remaining} restantes para próximas rodadas`
                        : 'Todos os elegíveis foram enfileirados!'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OnboardingBatchSheet;
