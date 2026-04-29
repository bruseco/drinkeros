import React, { useState } from 'react';
import StudyReminderSettings from '@/components/admin/StudyReminderSettings';
import StudyReminderStats from '@/components/admin/StudyReminderStats';
import OnboardingReminderSettings from '@/components/admin/OnboardingReminderSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePackages } from '@/hooks/usePackages';
import { useCourses } from '@/hooks/useCourses';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Bell, Send, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AdminNotifications: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/app');
  const [targetType, setTargetType] = useState('all');
  const [targetPackageId, setTargetPackageId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [targetUserEmails, setTargetUserEmails] = useState('');

  const { data: packages = [] } = usePackages();
  const { data: courses = [] } = useCourses(true);
  const queryClient = useQueryClient();

  // Check VAPID configuration
  const { data: vapidConfig, isLoading: vapidLoading } = useQuery({
    queryKey: ['vapid-config'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('get-vapid-key');
      return data;
    },
  });

  const isVapidConfigured = !!vapidConfig?.publicKey;

  // Subscription count
  const { data: subCount = 0 } = useQuery({
    queryKey: ['push-subscription-count'],
    queryFn: async () => {
      const { count } = await (supabase.from as any)('push_subscriptions')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  // Notification history
  const { data: notifications = [] } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      let targetUserIds: string[] = [];

      if (targetType === 'individual') {
        const emails = targetUserEmails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
        if (emails.length === 0) throw new Error('Informe pelo menos um email');
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id')
          .in('email', emails);
        targetUserIds = (profiles || []).map((p) => p.user_id);
        if (targetUserIds.length === 0) throw new Error('Nenhum usuário encontrado com esses emails');
      }

      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          body,
          url,
          targetType,
          targetPackageId: targetType === 'package' ? targetPackageId : null,
          targetCourseId: targetType === 'course' ? targetCourseId : null,
          targetUserIds,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Notificação enviada para ${data.sentCount} dispositivo(s)`);
      setTitle('');
      setBody('');
      setUrl('/app');
      setTargetUserEmails('');
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar notificação', { description: error.message });
    },
  });

  const targetLabel = (type: string) => {
    switch (type) {
      case 'all':
        return 'Todos';
      case 'package':
        return 'Módulo';
      case 'course':
        return 'Curso';
      case 'individual':
        return 'Individual';
      case 'study_reminder':
        return 'Lembrete de Estudo';
      case 'onboarding_reminder':
        return 'Lembrete de Onboarding';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Notificações Push</h1>
        <p className="text-muted-foreground">
          Envie notificações push para seus alunos • {subCount} dispositivo(s) registrado(s)
        </p>
      </div>

      {!vapidLoading && !isVapidConfigured && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            As chaves VAPID não estão configuradas. Adicione os secrets{' '}
            <code className="font-mono text-xs">VAPID_PUBLIC_KEY</code> e{' '}
            <code className="font-mono text-xs">VAPID_PRIVATE_KEY</code> para ativar push
            notifications.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Enviar Notificação
          </CardTitle>
          <CardDescription>Preencha os campos e selecione os destinatários</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nova aula disponível!"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>URL (ao clicar)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/app"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensagem *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Confira a nova aula sobre drinks clássicos..."
              maxLength={300}
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Destinatários</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os alunos</SelectItem>
                  <SelectItem value="package">Alunos de um módulo</SelectItem>
                  <SelectItem value="individual">Alunos específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === 'package' && (
              <div className="space-y-2">
                <Label>Módulo</Label>
                <Select value={targetPackageId} onValueChange={setTargetPackageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {targetType === 'individual' && (
            <div className="space-y-2">
              <Label>Emails dos alunos (separados por vírgula)</Label>
              <Textarea
                value={targetUserEmails}
                onChange={(e) => setTargetUserEmails(e.target.value)}
                placeholder="aluno1@email.com, aluno2@email.com"
                rows={2}
              />
            </div>
          )}

          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!title || !body || sendMutation.isPending || !isVapidConfigured}
            className="w-full"
          >
            {sendMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar Notificação
          </Button>
        </CardContent>
      </Card>

      <StudyReminderSettings />

      <OnboardingReminderSettings />

      <StudyReminderStats />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Envios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Enviadas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(n.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {n.body}
                  </TableCell>
                  <TableCell>{targetLabel(n.target_type)}</TableCell>
                  <TableCell className="text-right">{n.sent_count}</TableCell>
                </TableRow>
              ))}
              {notifications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma notificação enviada ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotifications;
