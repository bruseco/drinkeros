import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, ArrowLeft, Save, Crown, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClubeSettings } from '@/hooks/useClubeSettings';
import { useQueryClient } from '@tanstack/react-query';

const AdminClube: React.FC = () => {
  const { data: settings, isLoading } = useClubeSettings();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fullPrice, setFullPrice] = useState<string>('197');
  const [promoPrice, setPromoPrice] = useState<string>('47');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setFullPrice(String(settings.full_price));
    setPromoPrice(String(settings.promo_price));
    setBenefits(settings.benefits.map((b) => b.text));
  }, [settings]);

  const updateBenefit = (i: number, v: string) =>
    setBenefits((arr) => arr.map((b, idx) => (idx === i ? v : b)));
  const addBenefit = () => setBenefits((arr) => [...arr, '']);
  const removeBenefit = (i: number) =>
    setBenefits((arr) => arr.filter((_, idx) => idx !== i));
  const moveBenefit = (i: number, dir: -1 | 1) =>
    setBenefits((arr) => {
      const next = [...arr];
      const j = i + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    if (!settings?.id) {
      toast({ title: 'Configuração não carregada', variant: 'destructive' });
      return;
    }
    const fp = Number(fullPrice);
    const pp = Number(promoPrice);
    if (!Number.isFinite(fp) || fp <= 0) {
      toast({ title: 'Preço cheio inválido', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(pp) || pp <= 0) {
      toast({ title: 'Preço promocional inválido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('clube_settings' as any)
      .update({
        full_price: fp,
        promo_price: pp,
        benefits: benefits
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => ({ text: t })),
      })
      .eq('id', settings.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Configurações salvas!', description: 'Página /clube atualizada.' });
    qc.invalidateQueries({ queryKey: ['clube-settings'] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/admin/paginas-venda" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Crown className="h-7 w-7 text-amber-500" /> Clube dos Drinkeros
            </h1>
          </div>
          <p className="text-muted-foreground">
            Configurações da assinatura anual e da página de venda /clube.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/clube" target="_blank" rel="noopener noreferrer">
            Ver página <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </a>
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Preços</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="full_price">Valor cheio (R$)</Label>
            <Input
              id="full_price"
              type="number"
              min={0}
              step="0.01"
              value={fullPrice}
              onChange={(e) => setFullPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Exibido quando não há promoção ativa.
            </p>
          </div>
          <div>
            <Label htmlFor="promo_price">Valor promocional (R$)</Label>
            <Input
              id="promo_price"
              type="number"
              min={0}
              step="0.01"
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Aplicado durante a promoção de lançamento (UTM ou 3 visitas).
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Liberações da assinatura</h2>
            <p className="text-xs text-muted-foreground">
              Lista de benefícios mostrada no card do Sócio na página /clube. Você pode usar{' '}
              <code>&lt;strong&gt;</code> pra destacar palavras.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addBenefit}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {benefits.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma liberação cadastrada. Clique em "Adicionar" pra criar a primeira.
            </p>
          )}
          {benefits.map((b, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => moveBenefit(i, -1)}
                  disabled={i === 0}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => moveBenefit(i, 1)}
                  disabled={i === benefits.length - 1}
                >
                  ▼
                </button>
              </div>
              <Textarea
                value={b}
                onChange={(e) => updateBenefit(i, e.target.value)}
                rows={2}
                placeholder="Ex: <strong>Xaropes Artesanais</strong> liberados"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeBenefit(i)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Salvar alterações</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AdminClube;
