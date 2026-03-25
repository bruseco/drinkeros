import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CRMLead, PICO_VENDAS_STAGES } from '@/hooks/useCRMLeads';

interface Props {
  leads: CRMLead[];
}

const SYSTEM_VARIABLES = [
  { key: 'lead_name', label: 'Nome do Lead' },
  { key: 'lead_phone', label: 'Telefone' },
  { key: 'product_name', label: 'Produto' },
  { key: 'recovery_url', label: 'URL de Recuperação' },
];

export const CRMBulkTemplateDispatch: React.FC<Props> = ({ leads }) => {
  const [open, setOpen] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [targetStage, setTargetStage] = useState('oferta_enviada');
  const [variableMap, setVariableMap] = useState<Record<string, string>>({});
  const [staticValues, setStaticValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // Fetch Era Cloud connections
  const { data: connections = [] } = useQuery({
    queryKey: ['era-cloud-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zapi_connections')
        .select('id, name, phone_number')
        .eq('provider', 'era_cloud')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch approved templates for selected connection
  const { data: templates = [] } = useQuery({
    queryKey: ['approved-templates', connectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('status', 'APPROVED');
      if (error) throw error;
      return data;
    },
    enabled: !!connectionId && open,
  });

  const selectedTemplate = useMemo(
    () => templates.find(t => t.name === templateName),
    [templates, templateName]
  );

  // Extract variable count from template components
  const templateVariables = useMemo(() => {
    if (!selectedTemplate?.components) return [];
    const comps = selectedTemplate.components as any[];
    const vars: { index: number; key: string }[] = [];
    for (const comp of comps) {
      if (comp.type === 'BODY' && comp.example?.body_text) {
        const params = comp.example.body_text[0] || [];
        params.forEach((_: string, i: number) => {
          vars.push({ index: i + 1, key: String(i + 1) });
        });
      }
    }
    // Fallback: detect {{n}} pattern in text
    if (vars.length === 0) {
      for (const comp of comps) {
        const text = comp.text || '';
        const matches = text.matchAll(/\{\{(\d+)\}\}/g);
        for (const match of matches) {
          const idx = parseInt(match[1]);
          if (!vars.find(v => v.index === idx)) {
            vars.push({ index: idx, key: String(idx) });
          }
        }
      }
    }
    return vars.sort((a, b) => a.index - b.index);
  }, [selectedTemplate]);

  // Target leads (with phone, in selected stage)
  const targetLeads = useMemo(
    () => leads.filter(l => l.stage === targetStage && l.phone),
    [leads, targetStage]
  );

  // Build preview from first lead
  const previewText = useMemo(() => {
    if (!selectedTemplate?.components || targetLeads.length === 0) return '';
    const lead = targetLeads[0];
    const comps = selectedTemplate.components as any[];
    const bodyComp = comps.find((c: any) => c.type === 'BODY');
    if (!bodyComp?.text) return '';
    let text = bodyComp.text as string;
    for (const v of templateVariables) {
      const mapping = variableMap[v.key];
      let value = `{{${v.index}}}`;
      if (mapping === 'static') {
        value = staticValues[v.key] || `{{${v.index}}}`;
      } else if (mapping === 'lead_name') {
        value = lead.name;
      } else if (mapping === 'lead_phone') {
        value = lead.phone || '';
      } else if (mapping === 'product_name') {
        value = lead.product_name || '';
      } else if (mapping === 'recovery_url') {
        value = lead.recovery_url || '';
      }
      text = text.replace(`{{${v.index}}}`, value);
    }
    return text;
  }, [selectedTemplate, templateVariables, variableMap, staticValues, targetLeads]);

  const resolveVariable = (lead: CRMLead, varKey: string): string => {
    const mapping = variableMap[varKey];
    if (mapping === 'static') return (staticValues[varKey] || '').trim();
    if (mapping === 'lead_name') return lead.name || '';
    if (mapping === 'lead_phone') return lead.phone || '';
    if (mapping === 'product_name') return lead.product_name || '';
    if (mapping === 'recovery_url') return lead.recovery_url || '';
    return '';
  };

  const handleDispatch = async () => {
    if (!connectionId || !templateName || targetLeads.length === 0) return;

    setSending(true);
    try {
      const BATCH_SIZE = 200;
      let enqueued = 0;

      for (let i = 0; i < targetLeads.length; i += BATCH_SIZE) {
        const batch = targetLeads.slice(i, i + BATCH_SIZE);

        const queueItems = batch.map(lead => {
          const variables: Record<string, string> = {};
          for (const v of templateVariables) {
            const val = resolveVariable(lead, v.key);
            if (val) variables[String(v.index)] = val;
          }

          // Build readable message preview
          const paramPreview = Object.entries(variables)
            .map(([k, v]) => `{{${k}}}=${v}`)
            .join(', ');

          return {
            phone: lead.phone!,
            message: `[Template: ${templateName}] ${paramPreview}`,
            context_type: 'crm_pico_blast',
            context_data: {
              template_name: templateName,
              variables,
              connection_id: connectionId,
              lead_id: lead.id,
            },
            priority: 8,
            zapi_connection_id: connectionId,
          };
        });

        const { error: queueError } = await supabase
          .from('whatsapp_send_queue')
          .insert(queueItems as any);
        if (queueError) throw queueError;

        // Log activities
        const activities = batch.map(lead => ({
          lead_id: lead.id,
          activity_type: 'whatsapp_queued',
          description: `Template "${templateName}" enfileirado (disparo em massa)`,
        }));

        await supabase.from('crm_lead_activities').insert(activities as any);

        enqueued += batch.length;
      }

      toast.success(`${enqueued} mensagens enfileiradas com sucesso!`);
      setOpen(false);
    } catch (err: any) {
      toast.error('Erro ao enfileirar: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateChange = (name: string) => {
    setTemplateName(name);
    setVariableMap({});
    setStaticValues({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-1" /> Disparar Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Disparo em Massa de Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection */}
          <div>
            <Label>Conexão Era Cloud</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conexão" />
              </SelectTrigger>
              <SelectContent>
                {connections.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.phone_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template */}
          {connectionId && (
            <div>
              <Label>Template Aprovado</Label>
              <Select value={templateName} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Variable mapping */}
          {templateVariables.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Mapeamento de Variáveis</Label>
              {templateVariables.map(v => (
                <div key={v.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{`{{${v.index}}}`}</Label>
                  <div className="flex gap-2">
                    <Select
                      value={variableMap[v.key] || ''}
                      onValueChange={val => setVariableMap(prev => ({ ...prev, [v.key]: val }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_VARIABLES.map(sv => (
                          <SelectItem key={sv.key} value={sv.key}>
                            {sv.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="static">Valor fixo</SelectItem>
                      </SelectContent>
                    </Select>
                    {variableMap[v.key] === 'static' && (
                      <Input
                        className="flex-1"
                        placeholder="Digite o valor..."
                        value={staticValues[v.key] || ''}
                        onChange={e =>
                          setStaticValues(prev => ({ ...prev, [v.key]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Target stage */}
          <div>
            <Label>Estágio Alvo</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PICO_VENDAS_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {targetLeads.length} leads com telefone neste estágio
            </p>
          </div>

          {/* Preview */}
          {previewText && (
            <div>
              <Label className="text-sm font-semibold">Preview (1º lead)</Label>
              <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap mt-1">
                {previewText}
              </div>
            </div>
          )}

          {/* Dispatch button */}
          <Button
            onClick={handleDispatch}
            disabled={!connectionId || !templateName || targetLeads.length === 0 || sending}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enfileirando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Enfileirar {targetLeads.length} mensagens
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
