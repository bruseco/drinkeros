import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, Save } from 'lucide-react';

interface NiboService {
  id: string;
  name: string | null;
  cnae: string | null;
  lc116: string | null;
  municipal_code: string | null;
  iss_rate: number | string | null;
}

interface Mapping {
  product_type: string;
  nibo_service_id: string;
  nibo_service_name: string | null;
}

const PRODUCT_TYPES: { key: string; label: string; suggestion: string }[] = [
  { key: 'ebook', label: 'E-books / Material digital', suggestion: 'Livros e Periódicos' },
  { key: 'curso', label: 'Cursos', suggestion: 'Streaming' },
  { key: 'combo', label: 'Combos / Pacotes de cursos', suggestion: 'Streaming' },
  { key: 'pacote', label: 'Pacotes (módulos)', suggestion: 'Streaming' },
  { key: 'clube', label: 'Clube / Assinatura', suggestion: 'Streaming' },
];

export default function AdminNibo() {
  const [services, setServices] = useState<NiboService[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [usedPath, setUsedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const loadMappings = async () => {
    const { data } = await supabase.from('nibo_service_mappings' as any).select('*');
    const map: Record<string, Mapping> = {};
    (data as Mapping[] | null)?.forEach((m) => { map[m.product_type] = m; });
    setMappings(map);
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('nibo-list-services');
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Falha ao listar');
      setServices(data.services || []);
      setAttempts(data.attempts || []);
      setUsedPath(data.used_path);
      if ((data.services || []).length === 0) {
        toast({
          title: 'Nenhum serviço retornado',
          description: 'Veja as tentativas abaixo e cole o ID manualmente se necessário.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMappings(); }, []);

  const setMappingValue = (productType: string, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    setMappings((m) => ({
      ...m,
      [productType]: {
        product_type: productType,
        nibo_service_id: serviceId,
        nibo_service_name: svc?.name || m[productType]?.nibo_service_name || null,
      },
    }));
  };

  const save = async (productType: string) => {
    const m = mappings[productType];
    if (!m?.nibo_service_id) {
      toast({ title: 'ID obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(productType);
    const { error } = await supabase.from('nibo_service_mappings' as any).upsert({
      product_type: productType,
      nibo_service_id: m.nibo_service_id,
      nibo_service_name: m.nibo_service_name,
    }, { onConflict: 'product_type' });
    setSaving(null);
    if (error) {
      toast({ title: 'Falha ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mapeamento salvo' });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">NIBO · Perfis de serviço</h1>
          <p className="text-sm text-muted-foreground">
            Liste os perfis cadastrados na conta NIBO e associe a cada tipo de produto.
          </p>
        </div>
        <Button onClick={fetchServices} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Buscar perfis no NIBO
        </Button>
      </div>

      {usedPath && (
        <p className="text-xs text-muted-foreground">
          Endpoint usado: <code>{usedPath}</code> · {services.length} perfis encontrados
        </p>
      )}

      {services.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Perfis encontrados</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">LC 116</th>
                  <th className="py-2 pr-4">CNAE</th>
                  <th className="py-2 pr-4">Cód. Municipal</th>
                  <th className="py-2 pr-4">ISS</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 pr-4 font-mono text-xs">{s.id}</td>
                    <td className="py-2 pr-4">{s.name || '—'}</td>
                    <td className="py-2 pr-4">{s.lc116 || '—'}</td>
                    <td className="py-2 pr-4">{s.cnae || '—'}</td>
                    <td className="py-2 pr-4">{s.municipal_code || '—'}</td>
                    <td className="py-2 pr-4">{s.iss_rate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {attempts.length > 0 && services.length === 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Tentativas de endpoint</h2>
          <ul className="text-xs space-y-1 font-mono">
            {attempts.map((a, i) => (
              <li key={i}>
                [{a.status}] {a.path} {a.ok ? '✓' : '✗'} — {a.sample}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Mapeamento por tipo de produto</h2>
        <div className="space-y-3">
          {PRODUCT_TYPES.map((pt) => {
            const current = mappings[pt.key];
            return (
              <div key={pt.key} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{pt.label}</p>
                  <p className="text-xs text-muted-foreground">Sugerido: {pt.suggestion}</p>
                </div>
                {services.length > 0 ? (
                  <select
                    className="border rounded-md h-9 px-2 bg-background"
                    value={current?.nibo_service_id || ''}
                    onChange={(e) => setMappingValue(pt.key, e.target.value)}
                  >
                    <option value="">— escolher perfil —</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="Cole o NIBO service_id"
                    value={current?.nibo_service_id || ''}
                    onChange={(e) => setMappingValue(pt.key, e.target.value)}
                  />
                )}
                <Button size="sm" onClick={() => save(pt.key)} disabled={saving === pt.key}>
                  {saving === pt.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
