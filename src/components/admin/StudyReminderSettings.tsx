import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Save, Send, Loader2, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const StudyReminderSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLIFrameElement>(null);

  const [inactiveDays, setInactiveDays] = useState(7);
  const [isEnabled, setIsEnabled] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['study-reminder-settings'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('study_reminder_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch template for preview
  const { data: template } = useQuery({
    queryKey: ['study-reminder-template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('html_body, subject')
        .eq('slug', 'study-reminder')
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setInactiveDays(settings.inactive_days);
      setIsEnabled(settings.is_enabled);
    }
  }, [settings]);

  // Write template preview into iframe
  useEffect(() => {
    if (previewRef.current && showPreview && template?.html_body) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        const previewHtml = template.html_body
          .split('{{user_name}}').join('Aluno Exemplo')
          .split('{{email}}').join('aluno@exemplo.com')
          .split('{{inactive_days}}').join(String(inactiveDays))
          .split('{{login_url}}').join('#');
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [showPreview, template?.html_body, inactiveDays]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error('Configuração não encontrada');
      const { error } = await (supabase.from as any)('study_reminder_settings')
        .update({ inactive_days: inactiveDays, is_enabled: isEnabled })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações salvas');
      queryClient.invalidateQueries({ queryKey: ['study-reminder-settings'] });
    },
    onError: (err: any) => toast.error('Erro ao salvar', { description: err.message }),
  });

  // Manual send mutation with automatic batch chaining
  const sendNowMutation = useMutation({
    mutationFn: async () => {
      let offset = 0;
      let batchNum = 0;
      let totalInactive = 0;
      const totals = { push: 0, emails: 0, whatsapp: 0 };

      while (true) {
        batchNum++;
        const { data, error } = await supabase.functions.invoke('send-study-reminders', {
          body: { inactiveDays, forceRun: true, processOffset: offset },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

        totalInactive = data.totalInactive ?? totalInactive;
        totals.push += data.pushSent ?? 0;
        totals.emails += data.emailsSent ?? 0;
        totals.whatsapp += data.whatsappQueued ?? 0;

        if (data.hasMore) {
          const totalBatches = Math.ceil(totalInactive / (data.batchProcessed || 100));
          toast.info(`Processando lote ${batchNum}/${totalBatches}...`);
          offset = data.nextOffset;
        } else {
          break;
        }
      }

      return { totalInactive, ...totals };
    },
    onSuccess: (data) => {
      toast.success(
        `Lembrete enviado: ${data.push} push, ${data.emails} email(s), ${data.whatsapp} WhatsApp para ${data.totalInactive} aluno(s)`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err: any) => toast.error('Erro ao enviar lembrete', { description: err.message }),
  });

  const hasChanges =
    settings && (inactiveDays !== settings.inactive_days || isEnabled !== settings.is_enabled);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lembrete de Estudo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Lembrete de Estudo
        </CardTitle>
        <CardDescription>
          Envio automático de push + email para alunos inativos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable / Disable */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Lembrete automático</Label>
            <p className="text-sm text-muted-foreground">
              Enviar lembretes diariamente para alunos inativos
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        {/* Inactive days */}
        <div className="space-y-2">
          <Label htmlFor="inactiveDays">Dias de inatividade para disparar o lembrete</Label>
          <div className="flex items-center gap-3">
            <Input
              id="inactiveDays"
              type="number"
              min={1}
              max={30}
              value={inactiveDays}
              onChange={(e) => setInactiveDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">
              dias sem acessar nenhuma aula
            </span>
          </div>
        </div>

        {/* Cron info */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          <p>O lembrete é enviado automaticamente todos os dias às <strong className="text-foreground">10h (horário de Brasília)</strong>.</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar configurações
          </Button>
          <Button
            variant="outline"
            onClick={() => sendNowMutation.mutate()}
            disabled={sendNowMutation.isPending}
            className="gap-2"
          >
            {sendNowMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar lembrete agora
          </Button>
        </div>

        <Separator />

        {/* Template preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Template do email de lembrete</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-1 text-xs"
              >
                {showPreview ? 'Ocultar preview' : 'Ver preview'}
              </Button>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                <Link to="/admin/configuracoes">
                  <ExternalLink className="h-3 w-3" />
                  Editar template
                </Link>
              </Button>
            </div>
          </div>

          {showPreview && (
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <iframe
                ref={previewRef}
                title="Study Reminder Email Preview"
                className="h-[400px] w-full"
                sandbox="allow-same-origin"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudyReminderSettings;
