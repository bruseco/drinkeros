import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClipboardCheck, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import ReportActions from '@/components/admin/ReportActions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CSReport {
  id: string;
  report_date: string;
  report_text: string;
  metrics: Record<string, unknown>;
  alerts: string[];
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: string; icon: React.ReactNode; color: string }> = {
  ok: { label: 'Operacional', variant: 'default', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-500/10 text-green-700 border-green-200' },
  warning: { label: 'Atenção', variant: 'secondary', icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-yellow-500/10 text-yellow-700 border-yellow-200' },
  critical: { label: 'Crítico', variant: 'destructive', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-red-500/10 text-red-700 border-red-200' },
};

const formatInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={key++} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{match[3]}</code>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const formatReportText = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line → spacer
    if (!trimmed) { elements.push(<div key={i} className="h-2" />); i++; continue; }

    // Section header: line is entirely **emoji TEXT** (bold wrapping the whole line)
    const headerMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    if (headerMatch && /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(headerMatch[1])) {
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-4 mb-2 pb-1 border-b border-border">
          {headerMatch[1]}
        </h3>
      );
      i++; continue;
    }

    // Unordered list items (- or * prefix)
    if (/^[-*]\s/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(<li key={i} className="ml-1">{formatInline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-1">{items}</ul>);
      continue;
    }

    // Ordered list items
    if (/^\d+\.\s/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(<li key={i} className="ml-1">{formatInline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-1">{items}</ol>);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} className="my-0.5">{formatInline(trimmed)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
};

const AdminCSReports: React.FC = () => {
  const queryClient = useQueryClient();
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['cs-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as CSReport[];
    },
  });

  const generateReport = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke('cs-daily-report');
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success('Relatório gerado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cs-reports'] });
    },
    onError: (error) => {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório. Tente novamente.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Agente CS</h1>
            <p className="text-sm text-muted-foreground">
              Relatórios diários gerados por IA sobre a operação
            </p>
          </div>
        </div>
        <Button
          onClick={() => generateReport.mutate()}
          disabled={generateReport.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${generateReport.isPending ? 'animate-spin' : ''}`} />
          {generateReport.isPending ? 'Gerando...' : 'Gerar Relatório Agora'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : reports?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum relatório gerado ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Gerar Relatório Agora" para criar o primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports?.map((report) => {
            const config = statusConfig[report.status] || statusConfig.ok;
            const isOpen = openReportId === report.id;

            return (
              <Collapsible
                key={report.id}
                open={isOpen}
                onOpenChange={() => setOpenReportId(isOpen ? null : report.id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={config.color}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                          <CardTitle className="text-base">
                            {format(new Date(report.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(report.created_at), 'HH:mm')}
                          </span>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      {(report.alerts as string[])?.length > 0 && !isOpen && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(report.alerts as string[]).slice(0, 3).map((alert, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {alert}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="text-sm leading-relaxed border-t pt-4">
                        {formatReportText(report.report_text)}
                      </div>
                      {(report.alerts as string[])?.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <p className="text-sm font-medium mb-2">Alertas:</p>
                          <div className="flex gap-2 flex-wrap">
                            {(report.alerts as string[]).map((alert, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                ⚠️ {alert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <ReportActions metrics={report.metrics as Record<string, unknown>} />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCSReports;
