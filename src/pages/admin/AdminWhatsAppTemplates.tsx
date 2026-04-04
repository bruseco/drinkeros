import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ArrowLeft, Search, Trash2, FileText, MessageSquare, Megaphone, Wrench, Image, Play, File, Sparkles, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const WELCOME_TEMPLATE_BODY = `Oi, {{1}}! Tudo bem? 😊

Aqui é da equipe Drinkeros! Seu acesso ao {{2}} já está liberado 🎉

Seus dados de acesso:

Email: {{3}}
Senha temporária: {{4}}

Acesse aqui: https://alunos.criminallab.com.br/login

Recomendamos trocar a senha no primeiro acesso!

Qualquer dúvida é só chamar aqui que a gente te ajuda! 💪`;

const WELCOME_EXAMPLES: Record<string, string> = {
  '1': 'João',
  '2': 'Curso Penal Completo',
  '3': 'joao@email.com',
  '4': 'abc123',
};

const RECOVERY_CARRINHO_1A_BODY = `Oi, {{1}}! 😊 Notei que o {{2}} ficou esperando por voce no carrinho. Aconteceu alguma coisa? Se tiver qualquer duvida, estou aqui pra ajudar! Finalize sua compra: {{3}}`;
const RECOVERY_CARRINHO_1B_BODY = `{{1}}, seu carrinho com o {{2}} ainda esta disponivel! As vagas sao limitadas e nao queremos que voce perca essa oportunidade. Garanta o seu agora: {{3}}`;
const RECOVERY_CARRINHO_2A_BODY = `Oi, {{1}}! Sei que a decisao de investir no {{2}} e importante. Se o valor for uma preocupacao, posso te mostrar as opcoes de parcelamento. Veja mais: {{3}}`;
const RECOVERY_CARRINHO_2B_BODY = `{{1}}, essa e a ultima vez que vou te lembrar sobre o {{2}}. Depois disso, nao consigo garantir as mesmas condicoes. Aproveite agora: {{3}}`;

const RECOVERY_CARRINHO_EXAMPLES: Record<string, string> = {
  '1': 'Bruno',
  '2': 'Curso Penal Completo',
  '3': 'https://loja.com/checkout/abc',
};

const RECOVERY_PIX_1A_BODY = `Oi, {{1}}! Tudo bem? Notei que o PIX do {{2}} ainda nao foi confirmado. Aconteceu alguma coisa? Se precisar de ajuda com o pagamento, estou aqui! Acesse: {{3}}`;
const RECOVERY_PIX_1B_BODY = `{{1}}, o PIX do {{2}} ainda esta pendente e o prazo esta acabando! Nao queremos que voce perca sua vaga. Finalize aqui: {{3}}`;
const RECOVERY_PIX_2A_BODY = `Oi, {{1}}! Sei que imprevistos acontecem. Se o PIX do {{2}} nao deu certo, posso te ajudar com outra forma de pagamento. Fale comigo ou acesse: {{3}}`;
const RECOVERY_PIX_2B_BODY = `{{1}}, essa e a ultima vez que vou te lembrar sobre o {{2}}. O PIX ainda nao foi confirmado e nao consigo garantir as mesmas condicoes depois. Aproveite agora: {{3}}`;

const RECOVERY_PIX_EXAMPLES: Record<string, string> = {
  '1': 'Bruno',
  '2': 'Curso Penal Completo',
  '3': 'https://loja.com/checkout/abc',
};

const RECOVERY_CARTAO_1A_BODY = `Oi, {{1}}! Houve um probleminha com o cartao na compra do {{2}}. Isso acontece as vezes! Quer tentar novamente ou usar outro cartao? Acesse: {{3}}`;
const RECOVERY_CARTAO_1B_BODY = `{{1}}, o pagamento do {{2}} via cartao nao foi aprovado. Pode ser limite ou dados incorretos. Tente novamente com outro cartao aqui: {{3}}`;

const RECOVERY_CARTAO_EXAMPLES: Record<string, string> = {
  '1': 'Bruno',
  '2': 'Curso Penal Completo',
  '3': 'https://loja.com/checkout/abc',
};

const NURTURING_OFERTA_BODY = `Oi, {{1}}! Vimos que voce se interessou por um dos nossos cursos. Que tal conhecer o {{2}}? Ele pode ser exatamente o que voce precisa! Saiba mais: {{3}}`;

const NURTURING_OFERTA_EXAMPLES: Record<string, string> = {
  '1': 'Bruno',
  '2': 'Combo Direito Penal',
  '3': 'https://loja.com/checkout/xyz',
};

const VARIABLE_LABELS: Record<string, string> = {
  '1': 'Primeiro nome do aluno',
  '2': 'Nome do conteúdo/produto',
  '3': 'Email do aluno',
  '4': 'Senha temporária',
};

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  const nums = [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
  return nums.sort((a, b) => Number(a) - Number(b));
}

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
}

interface MetaConnection {
  id: string;
  name: string;
  waba_id: string | null;
  phone_number: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  APPROVED: { label: 'Aprovado', variant: 'default' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  REJECTED: { label: 'Rejeitado', variant: 'destructive' },
  PAUSED: { label: 'Pausado', variant: 'secondary' },
  DISABLED: { label: 'Desativado', variant: 'outline' },
};

const CATEGORY_MAP: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
};

function useMetaConnections() {
  return useQuery({
    queryKey: ['meta-cloud-connections'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('zapi_connections')
        .select('id, name, waba_id, phone_number')
        .eq('provider', 'era_cloud')
        .eq('is_active', true);
      if (error) throw error;
      return data as MetaConnection[];
    },
  });
}

function useTemplates(connectionId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-templates', connectionId],
    queryFn: async () => {
      if (!connectionId) return [];
      // The functions.invoke for GET doesn't support query params well, use fetch directly
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates?connection_id=${connectionId}`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao buscar templates');
      return (result.data || []) as MetaTemplate[];
    },
    enabled: !!connectionId,
  });
}

const getBodyText = (components: any[]) => {
  const body = components?.find((c: any) => c.type === 'BODY');
  return body?.text || '';
};

const AdminWhatsAppTemplates: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: connections = [], isLoading: loadingConns } = useMetaConnections();
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [step, setStep] = useState<'category' | 'form'>('category');

  // Auto-select first connection
  React.useEffect(() => {
    if (connections.length > 0 && !selectedConnection) {
      const withWaba = connections.find(c => c.waba_id);
      if (withWaba) setSelectedConnection(withWaba.id);
    }
  }, [connections, selectedConnection]);

  const { data: templates = [], isLoading: loadingTemplates, error: templatesError } = useTemplates(selectedConnection);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  // Create form state
  const [formCategory, setFormCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [formName, setFormName] = useState('');
  const [formLanguage, setFormLanguage] = useState('pt_BR');
  const [formHeaderType, setFormHeaderType] = useState<'none' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('none');
  const [formHeaderText, setFormHeaderText] = useState('');
  const [formHeaderMediaUrl, setFormHeaderMediaUrl] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formFooter, setFormFooter] = useState('');
  const [formButtons, setFormButtons] = useState<any[]>([]);
  const [formBodyExamples, setFormBodyExamples] = useState<Record<string, string>>({});

  const detectedVars = useMemo(() => extractVariables(formBody), [formBody]);

  const resetForm = () => {
    setStep('category');
    setFormCategory('MARKETING');
    setFormName('');
    setFormLanguage('pt_BR');
    setFormHeaderType('none');
    setFormHeaderText('');
    setFormHeaderMediaUrl('');
    setFormBody('');
    setFormFooter('');
    setFormButtons([]);
    setFormBodyExamples({});
  };

  const prefillWelcomeTemplate = () => {
    setFormCategory('UTILITY');
    setFormName('boas_vindas_aluno');
    setFormBody(WELCOME_TEMPLATE_BODY);
    setFormBodyExamples(WELCOME_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryCarrinho1A = () => {
    setFormCategory('MARKETING');
    setFormName('recuperacao_carrinho_1a');
    setFormBody(RECOVERY_CARRINHO_1A_BODY);
    setFormBodyExamples(RECOVERY_CARRINHO_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryCarrinho1B = () => {
    setFormCategory('MARKETING');
    setFormName('recuperacao_carrinho_1b');
    setFormBody(RECOVERY_CARRINHO_1B_BODY);
    setFormBodyExamples(RECOVERY_CARRINHO_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryCarrinho2A = () => {
    setFormCategory('MARKETING');
    setFormName('recuperacao_carrinho_2a');
    setFormBody(RECOVERY_CARRINHO_2A_BODY);
    setFormBodyExamples(RECOVERY_CARRINHO_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryCarrinho2B = () => {
    setFormCategory('MARKETING');
    setFormName('recuperacao_carrinho_2b');
    setFormBody(RECOVERY_CARRINHO_2B_BODY);
    setFormBodyExamples(RECOVERY_CARRINHO_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryPix1A = () => {
    setFormCategory('UTILITY');
    setFormName('recuperacao_pix_1a');
    setFormBody(RECOVERY_PIX_1A_BODY);
    setFormBodyExamples(RECOVERY_PIX_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryPix1B = () => {
    setFormCategory('UTILITY');
    setFormName('recuperacao_pix_1b');
    setFormBody(RECOVERY_PIX_1B_BODY);
    setFormBodyExamples(RECOVERY_PIX_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryPix2A = () => {
    setFormCategory('UTILITY');
    setFormName('recuperacao_pix_2a');
    setFormBody(RECOVERY_PIX_2A_BODY);
    setFormBodyExamples(RECOVERY_PIX_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryPix2B = () => {
    setFormCategory('UTILITY');
    setFormName('recuperacao_pix_2b');
    setFormBody(RECOVERY_PIX_2B_BODY);
    setFormBodyExamples(RECOVERY_PIX_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryCartao1A = () => {
    setFormCategory('UTILITY');
    setFormName('recuperacao_cartao_1a');
    setFormBody(RECOVERY_CARTAO_1A_BODY);
    setFormBodyExamples(RECOVERY_CARTAO_EXAMPLES);
    setStep('form');
  };

  const prefillRecoveryCartao1B = () => {
    setFormCategory('UTILITY');
    setFormName('recuperacao_cartao_1b');
    setFormBody(RECOVERY_CARTAO_1B_BODY);
    setFormBodyExamples(RECOVERY_CARTAO_EXAMPLES);
    setStep('form');
  };

  const prefillNurturingOferta = () => {
    setFormCategory('MARKETING');
    setFormName('nurturing_oferta_alternativa');
    setFormBody(NURTURING_OFERTA_BODY);
    setFormBodyExamples(NURTURING_OFERTA_EXAMPLES);
    setStep('form');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConnection) throw new Error('Selecione uma conexão');
      const components: any[] = [];
      if (formHeaderType === 'TEXT' && formHeaderText) {
        components.push({ type: 'HEADER', format: 'TEXT', text: formHeaderText });
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formHeaderType) && formHeaderMediaUrl) {
        components.push({
          type: 'HEADER',
          format: formHeaderType,
          example: { header_url: [formHeaderMediaUrl] },
        });
      }
      const bodyComponent: any = { type: 'BODY', text: formBody };
      const vars = extractVariables(formBody);
      if (vars.length > 0) {
        const exampleValues = vars.map(v => formBodyExamples[v] || `exemplo_${v}`);
        bodyComponent.example = { body_text: [exampleValues] };
      }
      components.push(bodyComponent);
      if (formFooter) {
        components.push({ type: 'FOOTER', text: formFooter });
      }
      if (formButtons.length > 0) {
        components.push({ type: 'BUTTONS', buttons: formButtons });
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          connection_id: selectedConnection,
          template: {
            name: formName,
            language: formLanguage,
            category: formCategory,
            components,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Erro ao criar template');
      }
      return result;
    },
    onSuccess: (result) => {
      if (result.already_exists) {
        toast.info('Este modelo já existe e está aguardando aprovação da Meta.');
      } else {
        toast.success('Template enviado para aprovação!');
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates', selectedConnection] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateName: string) => {
      if (!selectedConnection) throw new Error('Selecione uma conexão');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          connection_id: selectedConnection,
          template_name: templateName,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao excluir template');
      return result;
    },
    onSuccess: () => {
      toast.success('Template removido da listagem!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConnection) throw new Error('Selecione uma conexão');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-templates`;
      const session = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync',
          connection_id: selectedConnection,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao sincronizar');
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Sincronizado! ${result.synced} template(s) atualizados.`);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates', selectedConnection] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addQuickReplyButton = () => {
    if (formButtons.length >= 3) return;
    setFormButtons([...formButtons, { type: 'QUICK_REPLY', text: '' }]);
  };

  const addUrlButton = () => {
    if (formButtons.length >= 2) return;
    setFormButtons([...formButtons, { type: 'URL', text: '', url: '' }]);
  };

  const updateButton = (index: number, field: string, value: string) => {
    const updated = [...formButtons];
    updated[index] = { ...updated[index], [field]: value };
    setFormButtons(updated);
  };

  const removeButton = (index: number) => {
    setFormButtons(formButtons.filter((_, i) => i !== index));
  };

  const connectionsWithWaba = connections.filter(c => c.waba_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/whatsapp">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Modelos de Mensagem</h1>
            <p className="text-sm text-muted-foreground">Gerencie templates do WhatsApp Cloud API (Meta)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={!selectedConnection || syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} disabled={connectionsWithWaba.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Novo Modelo
          </Button>
        </div>
      </div>

      {/* Connection selector + search */}
      <div className="flex items-center gap-4">
        <div className="w-64">
          <Select value={selectedConnection || ''} onValueChange={setSelectedConnection}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conexão" />
            </SelectTrigger>
            <SelectContent>
              {connectionsWithWaba.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone_number})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {templates.length > 0 && (
          <span className="text-sm text-muted-foreground">{filteredTemplates.length} modelo(s)</span>
        )}
      </div>

      {/* No connections warning */}
      {!loadingConns && connectionsWithWaba.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-medium text-foreground mb-1">Nenhuma conexão Era Cloud com WABA ID</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Para gerenciar modelos, edite uma conexão Era Cloud e adicione o WABA ID.
            </p>
            <Link to="/admin/whatsapp/conexoes">
              <Button variant="outline">Ir para Conexões</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Templates table */}
      {selectedConnection && (
        <>
          {loadingTemplates ? (
            <p className="text-center text-muted-foreground py-8">Carregando modelos...</p>
          ) : templatesError ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-destructive text-sm">{(templatesError as Error).message}</p>
              </CardContent>
            </Card>
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-medium text-foreground mb-1">Nenhum modelo encontrado</h3>
                <p className="text-sm text-muted-foreground">Crie um novo modelo para enviar mensagens estruturadas.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((t) => {
                    const statusInfo = STATUS_MAP[t.status] || { label: t.status, variant: 'outline' as const };
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {t.category === 'MARKETING' ? <Megaphone className="h-3.5 w-3.5 text-muted-foreground" /> : <Wrench className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-sm">{CATEGORY_MAP[t.category] || t.category}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.language}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-xs text-muted-foreground truncate">{getBodyText(t.components)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Remover o modelo "${t.name}" da listagem? (Isso não afeta o template na Meta)`)) {
                                deleteMutation.mutate(t.name);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Modelo de Mensagem</DialogTitle>
          </DialogHeader>

          {step === 'category' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Selecione a categoria do modelo:</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setFormCategory('MARKETING'); setStep('form'); }}
                  className="p-6 border rounded-lg hover:border-primary hover:bg-accent/50 transition-colors text-left space-y-2"
                >
                  <Megaphone className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-foreground">Marketing</h3>
                  <p className="text-sm text-muted-foreground">Promoções, ofertas e atualizações de conteúdo</p>
                </button>
                <button
                  onClick={() => { setFormCategory('UTILITY'); setStep('form'); }}
                  className="p-6 border rounded-lg hover:border-primary hover:bg-accent/50 transition-colors text-left space-y-2"
                >
                  <Wrench className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-foreground">Utilidade</h3>
                  <p className="text-sm text-muted-foreground">Confirmações, alertas e informações transacionais</p>
                </button>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Ou use um modelo pronto:</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={prefillWelcomeTemplate}>
                    <Sparkles className="h-4 w-4 mr-2" /> Usar modelo de boas-vindas
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryCarrinho1A}>
                    <Megaphone className="h-4 w-4 mr-2" /> Carrinho Estágio 1 — Variação A (amigável)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryCarrinho1B}>
                    <Megaphone className="h-4 w-4 mr-2" /> Carrinho Estágio 1 — Variação B (urgência)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryCarrinho2A}>
                    <Megaphone className="h-4 w-4 mr-2" /> Carrinho Estágio 2 — Variação A (empático)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryCarrinho2B}>
                    <Megaphone className="h-4 w-4 mr-2" /> Carrinho Estágio 2 — Variação B (última chance)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryPix1A}>
                    <Wrench className="h-4 w-4 mr-2" /> PIX Estágio 1 — Variação A (amigável)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryPix1B}>
                    <Wrench className="h-4 w-4 mr-2" /> PIX Estágio 1 — Variação B (urgência)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryPix2A}>
                    <Wrench className="h-4 w-4 mr-2" /> PIX Estágio 2 — Variação A (empático)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryPix2B}>
                    <Wrench className="h-4 w-4 mr-2" /> PIX Estágio 2 — Variação B (última chance)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryCartao1A}>
                    <Wrench className="h-4 w-4 mr-2" /> Cartão Estágio 1 — Variação A (amigável)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillRecoveryCartao1B}>
                    <Wrench className="h-4 w-4 mr-2" /> Cartão Estágio 1 — Variação B (direto)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={prefillNurturingOferta}>
                    <Megaphone className="h-4 w-4 mr-2" /> Nurturing — Oferta Alternativa
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-6">
              {/* Form - 3 cols */}
              <div className="col-span-3 space-y-4">
                <div>
                  <Label>Categoria</Label>
                  <Badge variant="outline" className="ml-2">{CATEGORY_MAP[formCategory]}</Badge>
                  <Button variant="link" size="sm" onClick={() => setStep('category')}>Alterar</Button>
                </div>

                <div>
                  <Label>Nome do modelo</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    placeholder="nome_do_modelo"
                    maxLength={512}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Apenas letras minúsculas, números e underscores</p>
                </div>

                <div>
                  <Label>Idioma</Label>
                  <Select value={formLanguage} onValueChange={setFormLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt_BR">Português (BR)</SelectItem>
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Cabeçalho (opcional)</Label>
                  <Select value={formHeaderType} onValueChange={(v: 'none' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT') => { setFormHeaderType(v); setFormHeaderText(''); setFormHeaderMediaUrl(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cabeçalho</SelectItem>
                      <SelectItem value="TEXT">Texto</SelectItem>
                      <SelectItem value="IMAGE">Imagem</SelectItem>
                      <SelectItem value="VIDEO">Vídeo</SelectItem>
                      <SelectItem value="DOCUMENT">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                  {formHeaderType === 'TEXT' && (
                    <Input value={formHeaderText} onChange={(e) => setFormHeaderText(e.target.value)} placeholder="Texto do cabeçalho" className="mt-2" maxLength={60} />
                  )}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formHeaderType) && (
                    <div className="mt-2 space-y-1">
                      <Input value={formHeaderMediaUrl} onChange={(e) => setFormHeaderMediaUrl(e.target.value)} placeholder="https://url-publica-do-arquivo.jpg" />
                      <p className="text-xs text-muted-foreground">
                        {formHeaderType === 'IMAGE' && 'URL pública de imagem (jpg, png — máx. 5MB)'}
                        {formHeaderType === 'VIDEO' && 'URL pública de vídeo (mp4 — máx. 16MB)'}
                        {formHeaderType === 'DOCUMENT' && 'URL pública de documento (pdf — máx. 100MB)'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Corpo da mensagem *</Label>
                  <Textarea
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="Olá {{1}}, temos uma novidade para você!"
                    maxLength={1024}
                    rows={5}
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">Use {'{{1}}'}, {'{{2}}'} para variáveis</p>
                    <span className="text-xs text-muted-foreground">{formBody.length}/1024</span>
                  </div>
                </div>

                {detectedVars.length > 0 && (
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <Label className="text-sm">Exemplos das variáveis (obrigatório)</Label>
                    <p className="text-xs text-muted-foreground">A API exige valores de exemplo para cada variável.</p>
                    {detectedVars.map((v) => (
                      <div key={v} className="flex items-center gap-2">
                        <Badge variant="outline" className="flex-shrink-0 text-xs">{`{{${v}}}`}</Badge>
                        <Input
                          value={formBodyExamples[v] || ''}
                          onChange={(e) => setFormBodyExamples(prev => ({ ...prev, [v]: e.target.value }))}
                          placeholder={VARIABLE_LABELS[v] || `Exemplo para variável ${v}`}
                          className="h-8 text-sm"
                        />
                        {VARIABLE_LABELS[v] && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">{VARIABLE_LABELS[v]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <Label>Rodapé (opcional)</Label>
                  <Input value={formFooter} onChange={(e) => setFormFooter(e.target.value)} placeholder="Texto do rodapé" maxLength={60} />
                  <span className="text-xs text-muted-foreground">{formFooter.length}/60</span>
                </div>

                {/* Buttons */}
                <div className="space-y-2">
                  <Label>Botões (opcional)</Label>
                  {formButtons.map((btn, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded">
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {btn.type === 'QUICK_REPLY' ? 'Resposta Rápida' : 'URL'}
                      </Badge>
                      <Input
                        value={btn.text}
                        onChange={(e) => updateButton(i, 'text', e.target.value)}
                        placeholder="Texto do botão"
                        className="h-8 text-sm"
                        maxLength={25}
                      />
                      {btn.type === 'URL' && (
                        <Input
                          value={btn.url}
                          onChange={(e) => updateButton(i, 'url', e.target.value)}
                          placeholder="https://..."
                          className="h-8 text-sm"
                        />
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeButton(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={addQuickReplyButton} disabled={formButtons.length >= 3}>
                      + Resposta Rápida
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addUrlButton} disabled={formButtons.length >= 2}>
                      + URL
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={!formName || !formBody || createMutation.isPending || (detectedVars.length > 0 && detectedVars.some(v => !formBodyExamples[v]?.trim()))}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? 'Enviando...' : 'Enviar para Aprovação'}
                </Button>
              </div>

              {/* Preview - 2 cols */}
              <div className="col-span-2">
                <Label className="mb-2 block">Preview</Label>
                <div className="bg-[#e5ddd5] rounded-2xl p-4 max-w-[280px] mx-auto min-h-[400px] relative">
                  <div className="bg-white rounded-lg shadow-sm p-3 space-y-1">
                    {formHeaderType === 'TEXT' && formHeaderText && (
                      <p className="font-semibold text-sm text-gray-900">{formHeaderText}</p>
                    )}
                    {formHeaderType === 'IMAGE' && (
                      <div className="bg-gray-100 rounded flex items-center justify-center h-32 mb-1">
                        <Image className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    {formHeaderType === 'VIDEO' && (
                      <div className="bg-gray-100 rounded flex items-center justify-center h-32 mb-1">
                        <Play className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    {formHeaderType === 'DOCUMENT' && (
                      <div className="bg-gray-100 rounded flex items-center gap-2 p-3 mb-1">
                        <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 truncate">documento.pdf</span>
                      </div>
                    )}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {formBody || 'Corpo da mensagem...'}
                    </p>
                    {formFooter && (
                      <p className="text-[11px] text-gray-500">{formFooter}</p>
                    )}
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400">12:00</span>
                    </div>
                  </div>
                  {formButtons.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {formButtons.map((btn, i) => (
                        <div key={i} className="bg-white rounded-lg shadow-sm p-2 text-center text-sm text-blue-500 font-medium">
                          {btn.text || 'Botão'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWhatsAppTemplates;
