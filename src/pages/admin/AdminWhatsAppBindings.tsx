import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Link2, Plus, Check, AlertCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const PROCESSES = [
  { id: 'welcome_new', label: 'Boas-vindas (aluno novo)', description: 'Enviado automaticamente quando o aluno se matricula pela primeira vez no Criminal Lab. Contém credenciais de acesso.', availableVars: ['student_name', 'product_name', 'email', 'password', 'login_url'] },
  { id: 'welcome_existing', label: 'Boas-vindas (aluno existente)', description: 'Enviado quando um aluno que já tem conta compra um novo curso, combo ou módulo. Ele já possui login.', availableVars: ['student_name', 'product_name', 'email', 'login_url'] },
  { id: 'onboarding_followup', label: 'Reforço de onboarding (24h)', description: 'Enviado 24h após uma nova matrícula se o aluno ainda não fez login para consumir o conteúdo adquirido.', availableVars: ['student_name', 'login_url'] },
  { id: 'study_reminder', label: 'Reforço de estudo (7d inativo)', description: 'Enviado para alunos que iniciaram um curso mas estão há 7+ dias sem acessar a plataforma. Objetivo: trazer o aluno de volta para estudar.', availableVars: ['student_name', 'login_url'] },
  { id: 'upsell_1', label: 'Upsell - 1ª mensagem', description: '1ª mensagem de oferta. Enviada quando o aluno atinge 50%+ de um curso ou 10 dias após a matrícula sem estudar. Oferta um novo produto.', availableVars: ['student_name', 'product_name'] },
  { id: 'upsell_2', label: 'Upsell - 2ª mensagem', description: '2ª mensagem de oferta. Enviada após intervalo da 1ª, reforço da mesma oferta.', availableVars: ['student_name', 'product_name'] },
  { id: 'upsell_3', label: 'Upsell - 3ª mensagem', description: '3ª mensagem de oferta. Mais um reforço com abordagem diferente.', availableVars: ['student_name', 'product_name'] },
  { id: 'upsell_4', label: 'Upsell - 4ª mensagem', description: '4ª e última mensagem. Urgência ou última chance da oferta.', availableVars: ['student_name', 'product_name'] },
  { id: 'crm_recovery_carrinho_1', label: 'Recuperação - Carrinho Estágio 1', description: 'Primeiro contato com lead que abandonou o carrinho. O sistema sorteia entre os templates vinculados (variação A/B).', availableVars: ['lead_name', 'product_name', 'recovery_url'] },
  { id: 'crm_recovery_carrinho_2', label: 'Recuperação - Carrinho Estágio 2', description: 'Follow-up para lead que abandonou o carrinho pela segunda vez. Tom mais urgente. O sistema sorteia entre os templates vinculados.', availableVars: ['lead_name', 'product_name', 'recovery_url'] },
  { id: 'crm_recovery_pix', label: 'Recuperação - PIX não pago', description: 'Lead que gerou PIX mas não efetuou o pagamento. Enviado automaticamente via webhook.', availableVars: ['lead_name', 'product_name', 'recovery_url'] },
  { id: 'crm_recovery_cartao', label: 'Recuperação - Cartão recusado', description: 'Lead que tentou pagar com cartão e foi recusado. Enviado automaticamente via webhook.', availableVars: ['lead_name', 'product_name', 'recovery_url'] },
  { id: 'crm_recovery_geral', label: 'Recuperação - Geral', description: 'Mensagem genérica de recuperação para cenários não cobertos pelos processos específicos acima.', availableVars: ['lead_name', 'product_name', 'recovery_url'] },
  { id: 'crm_nurturing_oferta', label: 'Nurturing - Oferta Alternativa', description: 'Enviado automaticamente após X dias sem conversão. Oferece um produto alternativo baseado nas regras de upsell configuradas.', availableVars: ['lead_name', 'product_name', 'checkout_url'] },
];

const SYSTEM_VARIABLES = [
  { id: 'student_name', label: 'Nome do aluno', example: 'Bruno' },
  { id: 'product_name', label: 'Nome do produto', example: 'Curso Penal' },
  { id: 'email', label: 'Email do aluno', example: 'bruno@email.com' },
  { id: 'password', label: 'Senha temporária', example: 'abc123' },
  { id: 'login_url', label: 'Link de acesso', example: 'https://alunos.criminallab.com.br/login' },
  { id: 'lead_name', label: 'Nome do contato', example: 'Bruno' },
  { id: 'recovery_url', label: 'Link de recuperação', example: 'https://loja.com/checkout/abc' },
  { id: 'checkout_url', label: 'Link de checkout (oferta)', example: 'https://loja.com/checkout/xyz' },
];

function extractVariablesFromTemplate(components: any[]): string[] {
  const body = components?.find((c: any) => c.type === 'BODY');
  const text = body?.text || '';
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  const nums: string[] = matches.map((m: string) => m.replace(/[{}]/g, ''));
  const unique = Array.from(new Set(nums));
  return unique.sort((a, b) => Number(a) - Number(b));
}

function getBodyText(components: any[]): string {
  return components?.find((c: any) => c.type === 'BODY')?.text || '';
}

interface Binding {
  id: string;
  connection_id: string;
  template_name: string;
  process: string;
  variable_map: Record<string, string>;
  is_active: boolean;
}

interface Template {
  id: string;
  name: string;
  status: string;
  components: any[];
}

const AdminWhatsAppBindings: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch connections
  const { data: connections = [] } = useQuery({
    queryKey: ['era-cloud-connections'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('zapi_connections')
        .select('id, name, phone_number, waba_id')
        .eq('provider', 'era_cloud')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  React.useEffect(() => {
    if (connections.length > 0 && !selectedConnection) {
      const withWaba = connections.find((c: any) => c.waba_id);
      if (withWaba) setSelectedConnection(withWaba.id);
    }
  }, [connections, selectedConnection]);

  // Fetch approved templates for selected connection
  const { data: templates = [] } = useQuery({
    queryKey: ['approved-templates', selectedConnection],
    queryFn: async () => {
      if (!selectedConnection) return [];
      const { data, error } = await (supabase as any).from('whatsapp_templates')
        .select('id, name, status, components')
        .eq('connection_id', selectedConnection)
        .eq('status', 'APPROVED');
      if (error) throw error;
      return (data || []) as Template[];
    },
    enabled: !!selectedConnection,
  });

  // Fetch existing bindings
  const { data: bindings = [], isLoading: loadingBindings } = useQuery({
    queryKey: ['template-bindings', selectedConnection],
    queryFn: async () => {
      if (!selectedConnection) return [];
      const { data, error } = await (supabase as any).from('whatsapp_template_bindings')
        .select('*')
        .eq('connection_id', selectedConnection)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as Binding[];
    },
    enabled: !!selectedConnection,
  });

  // New binding form state
  const [newBindingState, setNewBindingState] = useState<Record<string, { templateName: string; variableMap: Record<string, string> }>>({});

  const getNewState = (processId: string) => newBindingState[processId] || { templateName: '', variableMap: {} };

  const setNewProcessTemplate = (processId: string, templateName: string) => {
    setNewBindingState(prev => ({
      ...prev,
      [processId]: { templateName, variableMap: prev[processId]?.variableMap || {} },
    }));
  };

  const setNewVariableMapping = (processId: string, varIndex: string, systemVar: string) => {
    setNewBindingState(prev => ({
      ...prev,
      [processId]: {
        ...prev[processId],
        variableMap: { ...prev[processId]?.variableMap, [varIndex]: systemVar },
      },
    }));
  };

  // Get bindings for a specific process
  const getProcessBindings = (processId: string) => bindings.filter(b => b.process === processId);

  // Add new binding (INSERT, not UPSERT)
  const addMutation = useMutation({
    mutationFn: async (processId: string) => {
      if (!selectedConnection) throw new Error('Selecione uma conexão');
      const state = getNewState(processId);
      if (!state.templateName) throw new Error('Selecione um template');

      const { error } = await (supabase as any).from('whatsapp_template_bindings')
        .insert({
          connection_id: selectedConnection,
          process: processId,
          template_name: state.templateName,
          variable_map: state.variableMap,
        });
      if (error) throw error;
    },
    onSuccess: (_, processId) => {
      toast.success('Template associado!');
      setNewBindingState(prev => ({ ...prev, [processId]: { templateName: '', variableMap: {} } }));
      queryClient.invalidateQueries({ queryKey: ['template-bindings', selectedConnection] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove binding
  const removeMutation = useMutation({
    mutationFn: async (bindingId: string) => {
      const { error } = await (supabase as any).from('whatsapp_template_bindings')
        .delete()
        .eq('id', bindingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Associação removida');
      queryClient.invalidateQueries({ queryKey: ['template-bindings', selectedConnection] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectionsWithWaba = connections.filter((c: any) => c.waba_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/whatsapp">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Associações de Templates</h1>
          <p className="text-sm text-muted-foreground">Associe múltiplos templates por processo — o sistema sorteará aleatoriamente no envio</p>
        </div>
      </div>

      {/* Connection selector */}
      {connectionsWithWaba.length > 0 && (
        <div className="w-72">
          <Label>Conexão</Label>
          <Select value={selectedConnection || ''} onValueChange={setSelectedConnection}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conexão" />
            </SelectTrigger>
            <SelectContent>
              {connectionsWithWaba.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone_number})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {connectionsWithWaba.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhuma conexão Era Cloud com WABA ID encontrada.</p>
            <Link to="/admin/whatsapp/conexoes">
              <Button variant="outline" className="mt-4">Ir para Conexões</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Process cards */}
      {selectedConnection && (
        <div className="space-y-4">
          {PROCESSES.map((process) => {
            const processBindings = getProcessBindings(process.id);
            const newState = getNewState(process.id);
            const selectedTemplate = templates.find((t: Template) => t.name === newState.templateName);
            const templateVars = selectedTemplate ? extractVariablesFromTemplate(selectedTemplate.components) : [];

            return (
              <Card key={process.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    {process.label}
                    {processBindings.length > 0 && (
                      <Badge variant="default" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        {processBindings.length} template{processBindings.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">{process.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Existing bindings list */}
                  {processBindings.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Templates associados:</Label>
                      {processBindings.map((b) => {
                        const tpl = templates.find((t: Template) => t.name === b.template_name);
                        const vars = tpl ? extractVariablesFromTemplate(tpl.components) : [];
                        return (
                          <div key={b.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="font-mono text-xs shrink-0">{b.template_name}</Badge>
                              {vars.length > 0 && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {vars.map(v => {
                                    const sysVar = (b.variable_map as Record<string, string>)?.[v];
                                    const info = SYSTEM_VARIABLES.find(sv => sv.id === sysVar);
                                    return `{{${v}}}→${info?.label || '?'}`;
                                  }).join(', ')}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                              onClick={() => removeMutation.mutate(b.id)}
                              disabled={removeMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add new binding form */}
                  <div className="border border-dashed border-border rounded-md p-3 space-y-3">
                    <Label className="text-xs font-medium">Adicionar template:</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Select
                          value={newState.templateName || 'none'}
                          onValueChange={(v) => setNewProcessTemplate(process.id, v === 'none' ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione um template</SelectItem>
                            {templates.map((t: Template) => (
                              <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Preview */}
                      {selectedTemplate && (
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Preview do corpo:</p>
                          <p className="text-xs whitespace-pre-wrap">
                            {(() => {
                              let body = getBodyText(selectedTemplate.components);
                              for (const [idx, sysVar] of Object.entries(newState.variableMap)) {
                                const varInfo = SYSTEM_VARIABLES.find(v => v.id === sysVar);
                                if (varInfo) {
                                  body = body.replace(new RegExp(`\\{\\{${idx}\\}\\}`, 'g'), `**${varInfo.example}**`);
                                }
                              }
                              return body;
                            })()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Variable mapping */}
                    {selectedTemplate && templateVars.length > 0 && (
                      <div>
                        <Label className="text-xs mb-2 block">Mapeamento de variáveis</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {templateVars.map((varIdx) => (
                            <div key={varIdx} className="flex items-center gap-2">
                              <Badge variant="outline" className="shrink-0 font-mono text-xs">{`{{${varIdx}}}`}</Badge>
                              <Select
                                value={newState.variableMap[varIdx] || 'none'}
                                onValueChange={(v) => setNewVariableMapping(process.id, varIdx, v === 'none' ? '' : v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Não mapeado —</SelectItem>
                                  {process.availableVars.map((av) => {
                                    const info = SYSTEM_VARIABLES.find(v => v.id === av);
                                    return (
                                      <SelectItem key={av} value={av}>
                                        {info?.label || av}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {newState.templateName && (
                      <Button
                        size="sm"
                        onClick={() => addMutation.mutate(process.id)}
                        disabled={addMutation.isPending}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminWhatsAppBindings;
