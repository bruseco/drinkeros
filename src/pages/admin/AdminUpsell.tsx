import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useUpsellSettings,
  useUpdateUpsellSettings,
  useUpsellSequences,
  useUpsellEmailLogs,
  useCancelUpsellSequence,
  type UpsellSequence,
} from '@/hooks/useUpsellSettings';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Rocket,
  Save,
  Send,
  Loader2,
  TrendingUp,
  Mail,
  Users,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  MessageCircle,
  Copy,
  Link,
  MousePointerClick,
  Plus,
  Trash2,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const EMAIL_SCHEDULE: Record<number, { day: number; period: string }> = {
  1: { day: 1, period: 'Manhã' },
  2: { day: 1, period: 'Noite' },
  3: { day: 2, period: 'Manhã' },
  4: { day: 2, period: 'Noite' },
  5: { day: 3, period: 'Manhã' },
  6: { day: 3, period: 'Noite' },
  7: { day: 4, period: 'Manhã' },
  8: { day: 4, period: 'Meio-dia' },
  9: { day: 4, period: 'Noite' },
};

const AdminUpsell: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useUpsellSettings();
  const updateSettings = useUpdateUpsellSettings();
  const { data: sequences, isLoading: sequencesLoading } = useUpsellSequences();
  const cancelSequence = useCancelUpsellSequence();

  const [isEnabled, setIsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [threshold, setThreshold] = useState(60);
  const [cooldownDays, setCooldownDays] = useState(15);
  const [enrollmentDaysTrigger, setEnrollmentDaysTrigger] = useState(10);
  const [selectedSequence, setSelectedSequence] = useState<UpsellSequence | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  // Offer map form state
  const [triggerType, setTriggerType] = useState<string>('course');
  const [triggerProductId, setTriggerProductId] = useState<string>('');
  const [offerType, setOfferType] = useState<string>('course');
  const [offerProductId, setOfferProductId] = useState<string>('');
  const [rulePriority, setRulePriority] = useState(1);
  const [triggerSearch, setTriggerSearch] = useState('');
  const [offerSearch, setOfferSearch] = useState('');

  const { data: emailLogs, isLoading: logsLoading } = useUpsellEmailLogs(selectedSequence?.id || null);

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-upsell'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      return data || [];
    },
  });

  const { data: packages } = useQuery({
    queryKey: ['all-packages-upsell'],
    queryFn: async () => {
      const { data } = await supabase.from('packages').select('id, name');
      return data || [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ['all-courses-upsell'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, name');
      return data || [];
    },
  });

  const { data: redirectLinks } = useQuery({
    queryKey: ['redirect-links-analytics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('redirect_links')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Offer map rules query
  const { data: productRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['upsell-product-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('upsell_product_rules')
        .select('*')
        .order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: async (rule: {
      trigger_product_type: string;
      trigger_product_id: string;
      offer_product_type: string;
      offer_product_id: string;
      priority: number;
    }) => {
      const { error } = await supabase.from('upsell_product_rules').insert(rule);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-product-rules'] });
      toast.success('Regra adicionada!');
      setTriggerProductId('');
      setOfferProductId('');
      setRulePriority(1);
    },
    onError: (err: any) => toast.error('Erro ao adicionar regra', { description: err.message }),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('upsell_product_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-product-rules'] });
    },
    onError: (err: any) => toast.error('Erro ao atualizar regra', { description: err.message }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('upsell_product_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-product-rules'] });
      toast.success('Regra excluída!');
    },
    onError: (err: any) => toast.error('Erro ao excluir regra', { description: err.message }),
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: number }) => {
      const { error } = await supabase.from('upsell_product_rules').update({ priority }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-product-rules'] });
    },
    onError: (err: any) => toast.error('Erro ao atualizar prioridade', { description: err.message }),
  });

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setWhatsappEnabled(settings.whatsapp_enabled ?? false);
      setThreshold(settings.progress_threshold);
      setCooldownDays(settings.cooldown_days);
      setEnrollmentDaysTrigger(settings.enrollment_days_trigger ?? 10);
    }
  }, [settings]);

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
  const packageMap = new Map((packages || []).map((p) => [p.id, p.name]));
  const courseMap = new Map((courses || []).map((c) => [c.id, c.name]));

  const sortedCourses = useMemo(() =>
    [...(courses || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [courses]
  );
  const sortedPackages = useMemo(() =>
    [...(packages || [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [packages]
  );

  const getProductList = (type: string, search: string) => {
    const list = type === 'course' ? sortedCourses : sortedPackages;
    if (!search) return list;
    const lower = search.toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(lower));
  };

  const getProductNameById = (type: string, id: string) => {
    if (type === 'course') return courseMap.get(id) || 'Curso removido';
    return packageMap.get(id) || 'Módulo removido';
  };

  const hasChanges =
    settings &&
    (isEnabled !== settings.is_enabled ||
      whatsappEnabled !== (settings.whatsapp_enabled ?? false) ||
      threshold !== settings.progress_threshold ||
      cooldownDays !== settings.cooldown_days ||
      enrollmentDaysTrigger !== (settings.enrollment_days_trigger ?? 10));

  const handleSave = () => {
    if (!settings?.id) return;
    updateSettings.mutate({
      id: settings.id,
      is_enabled: isEnabled,
      whatsapp_enabled: whatsappEnabled,
      progress_threshold: threshold,
      cooldown_days: cooldownDays,
      enrollment_days_trigger: enrollmentDaysTrigger,
    });
  };

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-upsell');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Upsell processado: ${data.sent} email(s) enviado(s) de ${data.totalStudents} aluno(s)`);
    },
    onError: (err: any) => toast.error('Erro ao processar upsell', { description: err.message }),
  });

  const getProductName = (seq: any) => {
    if (seq.product_type === 'course') return courseMap.get(seq.product_id) || 'Curso removido';
    return packageMap.get(seq.product_id) || 'Módulo removido';
  };

  const getStudentInfo = (userId: string) => {
    const p = profileMap.get(userId);
    return { name: p?.full_name || p?.email || userId.slice(0, 8), email: p?.email || '' };
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
      active: { variant: 'default', label: 'Ativo' },
      completed: { variant: 'secondary', label: 'Concluído' },
      cancelled: { variant: 'destructive', label: 'Cancelado' },
      converted: { variant: 'outline', label: 'Convertido', className: 'border-green-500 text-green-700 bg-green-50' },
    };
    const c = config[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
  };

  const getScheduledDate = (seq: UpsellSequence, step: number) => {
    const schedule = EMAIL_SCHEDULE[step];
    if (!schedule) return null;
    const created = new Date(seq.created_at);
    const target = new Date(created);
    target.setDate(target.getDate() + (schedule.day - 1));
    return target;
  };

  const totalSent = sequences?.length || 0;
  const activeSent = sequences?.filter((s) => s.status === 'active').length || 0;
  const convertedCount = sequences?.filter((s) => s.status === 'converted').length || 0;
  const uniqueStudents = new Set(sequences?.map((s) => s.user_id)).size;

  const handleAddRule = () => {
    if (!triggerProductId || !offerProductId) {
      toast.error('Selecione os produtos de gatilho e oferta');
      return;
    }
    addRuleMutation.mutate({
      trigger_product_type: triggerType,
      trigger_product_id: triggerProductId,
      offer_product_type: offerType,
      offer_product_id: offerProductId,
      priority: rulePriority,
    });
  };

  if (settingsLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6" /> Máquina de Ascensão
        </h1>
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-muted rounded-lg" />
          <div className="h-60 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Rocket className="h-6 w-6" /> Máquina de Ascensão
      </h1>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Package className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="offer-map" className="gap-2">
            <MapPin className="h-4 w-4" />
            Mapa de Ofertas
          </TabsTrigger>
        </TabsList>

        {/* ===== SETTINGS TAB ===== */}
        <TabsContent value="settings" className="space-y-6">
          <p className="text-muted-foreground">
            Sequência de 9 emails em 4 dias gerados por IA para alunos que completam mais de {threshold}% de um módulo.
          </p>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Mail className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{totalSent}</p>
                    <p className="text-sm text-muted-foreground">Sequências</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{uniqueStudents}</p>
                    <p className="text-sm text-muted-foreground">Alunos impactados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{activeSent}</p>
                    <p className="text-sm text-muted-foreground">Sequências ativas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{convertedCount}</p>
                    <p className="text-sm text-muted-foreground">Convertidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Configurações
              </CardTitle>
              <CardDescription>
                Configure o gatilho de progresso e o intervalo entre ofertas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Upsell automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar ofertas personalizadas por IA para alunos engajados
                  </p>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp na Ascensão
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar 4 mensagens personalizadas por WhatsApp em 4 dias (1 por dia)
                  </p>
                </div>
                <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Progresso mínimo para gatilho (%)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={10}
                      max={100}
                      value={threshold}
                      onChange={(e) => setThreshold(Math.max(10, Math.min(100, parseInt(e.target.value) || 60)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% de conclusão</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dias após inscrição para gatilho</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={enrollmentDaysTrigger}
                      onChange={(e) => setEnrollmentDaysTrigger(Math.max(1, Math.min(90, parseInt(e.target.value) || 10)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">dias após última compra</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cooldown entre ofertas (dias)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={cooldownDays}
                      onChange={(e) => setCooldownDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 15)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">dias entre sequências</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSave}
                  disabled={updateSettings.isPending || !hasChanges}
                  className="gap-2"
                >
                  {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar configurações
                </Button>
                <Button
                  variant="outline"
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                  className="gap-2"
                >
                  {triggerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Processar upsell agora
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sending Cadence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Cadência de Envio
              </CardTitle>
              <CardDescription>
                9 emails distribuídos em 4 dias (horários BRT)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((day) => {
                  const dayEmails = Object.entries(EMAIL_SCHEDULE)
                    .filter(([, s]) => s.day === day)
                    .map(([step, s]) => ({ step: Number(step), ...s }));
                  return (
                    <div key={day} className="rounded-lg border p-4 space-y-2">
                      <h4 className="font-semibold text-sm">Dia {day}</h4>
                      <div className="space-y-1.5">
                        {dayEmails.map((e) => (
                          <div key={e.step} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs min-w-[60px] justify-center">
                              {e.period}
                            </Badge>
                            <span className="text-muted-foreground">Email {e.step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Manhã: 09h BRT • Meio-dia: 13h BRT • Noite: 19h BRT
              </p>
            </CardContent>
          </Card>

          {/* UTM Template for Facebook Ads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Template UTM para Facebook Ads
              </CardTitle>
              <CardDescription>
                Copie e cole este template nos campos de URL dos seus anúncios no Facebook Ads Manager
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 font-mono text-sm break-all">
                {'utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}'}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText('utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}');
                  toast.success('Template UTM copiado!');
                }}
              >
                <Copy className="h-4 w-4" />
                Copiar template
              </Button>
            </CardContent>
          </Card>

          {/* Redirect Links Analytics */}
          {redirectLinks && redirectLinks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MousePointerClick className="h-5 w-5" />
                  Links de Redirecionamento
                </CardTitle>
                <CardDescription>
                  Últimos links gerados com contagem de cliques
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Cliques</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Último clique</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redirectLinks.map((link: any) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">{link.product_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{link.source}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{link.click_count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(link.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {link.last_clicked_at
                              ? format(new Date(link.last_clicked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Sequências</CardTitle>
              <CardDescription>Clique em uma linha para ver os detalhes dos emails</CardDescription>
            </CardHeader>
            <CardContent>
              {sequencesLoading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : !sequences || sequences.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma sequência de upsell enviada ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Assunto</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sequences.map((seq) => (
                        <TableRow
                          key={seq.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSequence(seq)}
                        >
                          <TableCell className="font-medium">{getStudentInfo(seq.user_id).name}</TableCell>
                          <TableCell>{getProductName(seq)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {seq.product_type === 'course' ? 'Curso' : 'Módulo'}
                            </Badge>
                          </TableCell>
                          <TableCell>{statusBadge(seq.status)}</TableCell>
                          <TableCell className="text-sm font-medium">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {seq.emails_sent}/9</span>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {(seq as any).whatsapp_sent || 0}/4</span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {seq.ai_generated_subject || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(seq.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== OFFER MAP TAB ===== */}
        <TabsContent value="offer-map" className="space-y-6">
          <p className="text-muted-foreground">
            Configure as regras de oferta: quem se matriculou em X, recebe oferta de Y.
          </p>

          {/* Add Rule Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Nova Regra de Oferta
              </CardTitle>
              <CardDescription>
                Defina o produto gatilho e o produto que será oferecido
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Tipo do Gatilho</Label>
                  <Select value={triggerType} onValueChange={(v) => { setTriggerType(v); setTriggerProductId(''); setTriggerSearch(''); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Curso</SelectItem>
                      <SelectItem value="package">Módulo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produto Gatilho</Label>
                  <Select value={triggerProductId} onValueChange={setTriggerProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Buscar..."
                          value={triggerSearch}
                          onChange={(e) => setTriggerSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {getProductList(triggerType, triggerSearch).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                      {getProductList(triggerType, triggerSearch).length === 0 && (
                        <p className="text-sm text-muted-foreground px-2 py-1">Nenhum resultado</p>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo da Oferta</Label>
                  <Select value={offerType} onValueChange={(v) => { setOfferType(v); setOfferProductId(''); setOfferSearch(''); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course">Curso</SelectItem>
                      <SelectItem value="package">Módulo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Produto Oferta</Label>
                  <Select value={offerProductId} onValueChange={setOfferProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Buscar..."
                          value={offerSearch}
                          onChange={(e) => setOfferSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {getProductList(offerType, offerSearch).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                      {getProductList(offerType, offerSearch).length === 0 && (
                        <p className="text-sm text-muted-foreground px-2 py-1">Nenhum resultado</p>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={rulePriority}
                      onChange={(e) => setRulePriority(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                    <Button
                      onClick={handleAddRule}
                      disabled={addRuleMutation.isPending || !triggerProductId || !offerProductId}
                      className="gap-2"
                    >
                      {addRuleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rules Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Regras Cadastradas
              </CardTitle>
              <CardDescription>
                {productRules?.length || 0} regra(s) configurada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : !productRules || productRules.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma regra cadastrada. Adicione a primeira regra acima.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto Gatilho</TableHead>
                        <TableHead>Produto Oferta</TableHead>
                        <TableHead className="w-[100px]">Prioridade</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[60px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {rule.trigger_product_type === 'course' ? 'Curso' : 'Módulo'}
                              </Badge>
                              <span className="font-medium">{getProductNameById(rule.trigger_product_type, rule.trigger_product_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {rule.offer_product_type === 'course' ? 'Curso' : 'Módulo'}
                              </Badge>
                              <span className="font-medium">{getProductNameById(rule.offer_product_type, rule.offer_product_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              defaultValue={rule.priority}
                              className="w-16 h-8"
                              onBlur={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                if (val !== rule.priority) {
                                  updatePriorityMutation.mutate({ id: rule.id, priority: val });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={(checked) =>
                                toggleRuleMutation.mutate({ id: rule.id, is_active: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sequence Detail Sheet */}
      <Sheet open={!!selectedSequence} onOpenChange={(open) => { if (!open) { setSelectedSequence(null); setExpandedStep(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Sequência</SheetTitle>
            <SheetDescription>Timeline de emails e informações do aluno</SheetDescription>
          </SheetHeader>

          {selectedSequence && (
            <div className="mt-6 space-y-6">
              {/* Student Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Aluno</h3>
                <p className="font-medium">{getStudentInfo(selectedSequence.user_id).name}</p>
                <p className="text-sm text-muted-foreground">{getStudentInfo(selectedSequence.user_id).email}</p>
              </div>

              {/* Product Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Produto Ofertado</h3>
                <p className="font-medium">{getProductName(selectedSequence)}</p>
                <Badge variant="outline">
                  {selectedSequence.product_type === 'course' ? 'Curso' : 'Módulo'}
                </Badge>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Status</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(selectedSequence.status)}
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {selectedSequence.emails_sent}/9
                  </span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {selectedSequence.whatsapp_sent || 0}/4
                  </span>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Timeline de Emails</h3>
                {logsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Carregando...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from({ length: 9 }, (_, i) => i + 1).map((step) => {
                      const log = (emailLogs || []).find((l) => l.step === step && (l.channel || 'email') === 'email');
                      const schedule = EMAIL_SCHEDULE[step];
                      const scheduledDate = getScheduledDate(selectedSequence, step);
                      const isSent = !!log;
                      const isPending = !isSent && selectedSequence.status === 'active' && step > selectedSequence.emails_sent;
                      const isSkipped = !isSent && selectedSequence.status !== 'active' && step > selectedSequence.emails_sent;

                      return (
                        <div
                          key={`email-${step}`}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            isSent ? 'bg-green-50 border-green-200' :
                            isPending ? 'bg-amber-50 border-amber-200' :
                            'bg-muted/50 border-muted'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isSent ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : isPending ? (
                              <Clock className="h-5 w-5 text-amber-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-semibold">Email {step}</span>
                              <span className="text-xs text-muted-foreground">
                                Dia {schedule.day} • {schedule.period}
                              </span>
                            </div>
                            {isSent && log ? (
                              <>
                                <p className={`text-sm mt-1 ${expandedStep === step ? '' : 'truncate'}`}>{log.subject || 'Sem assunto'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-muted-foreground">
                                    Enviado em {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                  {log.body_html && (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                      onClick={(e) => { e.stopPropagation(); setExpandedStep(expandedStep === step ? null : step); }}
                                    >
                                      {expandedStep === step ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                      {expandedStep === step ? 'Ocultar' : 'Ver email'}
                                    </button>
                                  )}
                                </div>
                                {expandedStep === step && log.body_html && (
                                  <div
                                    className="mt-2 rounded border bg-white p-3 max-h-[400px] overflow-y-auto prose prose-sm text-foreground"
                                    dangerouslySetInnerHTML={{ __html: log.body_html }}
                                  />
                                )}
                              </>
                            ) : isPending && scheduledDate ? (
                              <p className="text-xs text-amber-700 mt-1">
                                Previsto para {format(scheduledDate, "dd/MM/yyyy", { locale: ptBR })} • {schedule.period}
                              </p>
                            ) : isSkipped ? (
                              <p className="text-xs text-muted-foreground mt-1">Não enviado</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* WhatsApp Timeline */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Timeline WhatsApp
                </h3>
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, i) => i + 1).map((step) => {
                    const log = (emailLogs || []).find((l) => l.step === step && l.channel === 'whatsapp');
                    const isSent = !!log;
                    const waStep = selectedSequence.whatsapp_sent || 0;
                    const isPending = !isSent && selectedSequence.status === 'active' && step > waStep;
                    const isSkipped = !isSent && selectedSequence.status !== 'active' && step > waStep;
                    const dayLabels: Record<number, string> = { 1: 'Conexão', 2: 'Valor', 3: 'Prova Social', 4: 'Escassez' };
                    const expandKey = 100 + step;

                    return (
                      <div
                        key={`wa-${step}`}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          isSent ? 'bg-green-50 border-green-200' :
                          isPending ? 'bg-amber-50 border-amber-200' :
                          'bg-muted/50 border-muted'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isSent ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : isPending ? (
                            <Clock className="h-5 w-5 text-amber-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold">Dia {step} - {dayLabels[step]}</span>
                          </div>
                          {isSent && log ? (
                            <>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-muted-foreground">
                                  Enviado em {format(new Date(log.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {log.body_html && (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    onClick={(e) => { e.stopPropagation(); setExpandedStep(expandedStep === expandKey ? null : expandKey); }}
                                  >
                                    {expandedStep === expandKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    {expandedStep === expandKey ? 'Ocultar' : 'Ver mensagem'}
                                  </button>
                                )}
                              </div>
                              {expandedStep === expandKey && log.body_html && (
                                <div className="mt-2 rounded border bg-white p-3 max-h-[300px] overflow-y-auto text-sm whitespace-pre-wrap">
                                  {log.body_html}
                                </div>
                              )}
                            </>
                          ) : isPending ? (
                            <p className="text-xs text-amber-700 mt-1">Aguardando envio</p>
                          ) : isSkipped ? (
                            <p className="text-xs text-muted-foreground mt-1">Não enviado</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cancel button */}
              {selectedSequence.status === 'active' && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    cancelSequence.mutate(selectedSequence.id);
                    setSelectedSequence(null);
                  }}
                  disabled={cancelSequence.isPending}
                >
                  {cancelSequence.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Cancelar Sequência
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminUpsell;
