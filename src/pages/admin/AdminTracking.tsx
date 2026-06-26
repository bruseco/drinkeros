import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Info, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TrackingSettings {
  id: string;
  facebook_pixel_id: string | null;
  facebook_pixel_enabled: boolean;
  meta_test_event_code: string | null;
}

const AdminTracking: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tracking_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracking_settings')
        .select('id, facebook_pixel_id, facebook_pixel_enabled, meta_test_event_code')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TrackingSettings | null;
    },
  });

  const [pixelId, setPixelId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');

  useEffect(() => {
    if (data) {
      setPixelId(data.facebook_pixel_id ?? '');
      setEnabled(data.facebook_pixel_enabled);
      setTestEventCode(data.meta_test_event_code ?? '');
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('Configuração não encontrada');
      const { error } = await supabase
        .from('tracking_settings')
        .update({
          facebook_pixel_id: pixelId.trim() || null,
          facebook_pixel_enabled: enabled,
          meta_test_event_code: testEventCode.trim() || null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações salvas');
      qc.invalidateQueries({ queryKey: ['tracking_settings'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Métricas
        </h1>
        <p className="text-muted-foreground">Configure os pixels e ferramentas de rastreamento.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facebook Pixel (Meta)</CardTitle>
          <CardDescription>
            Insira o ID do seu pixel para rastrear visitas e conversões nas páginas públicas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled" className="text-base">Pixel ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativado, o pixel é carregado em todas as páginas públicas.
                  </p>
                </div>
                <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pixelId">ID do Pixel</Label>
                <Input
                  id="pixelId"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="Ex: 1234567890123456"
                />
                <p className="text-xs text-muted-foreground">
                  Você encontra o ID em business.facebook.com → Eventos → Fontes de dados.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capiToken">Token da Conversions API (CAPI)</Label>
                <Input
                  id="capiToken"
                  type="password"
                  value={capiToken}
                  onChange={(e) => setCapiToken(e.target.value)}
                  placeholder="EAAG... (token de longa duração)"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Usado para enviar eventos server-side (Purchase) direto para a Meta. Gere em Eventos → Configurações → Conversions API.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="testEventCode">Código de Evento de Teste (opcional)</Label>
                <Input
                  id="testEventCode"
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value)}
                  placeholder="TEST12345"
                />
                <p className="text-xs text-muted-foreground">
                  Quando preenchido, eventos via CAPI aparecem em "Eventos de teste" no Gerenciador de Eventos. Deixe em branco para desativar o modo de teste.
                </p>
              </div>


              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  O pixel envia automaticamente o evento <strong>PageView</strong> a cada navegação.
                </AlertDescription>
              </Alert>

              <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {save.isPending ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTracking;
