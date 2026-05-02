import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Crown, CreditCard, Loader2, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useUserPayments } from '@/hooks/useUserPayments';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabel: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  failed: 'Falhou',
  refunded: 'Estornado',
};
const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  pending: 'secondary',
  failed: 'destructive',
  refunded: 'outline',
};
const sourceLabel: Record<string, string> = {
  stripe: 'Cartão',
  mercadopago: 'Mercado Pago',
  manual: 'Manual',
  import: 'Importação',
  vip_bonus: 'Bônus',
};

const UserClubeManage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: plan, isLoading: loadingPlan } = useUserPlan();
  const { data: payments = [], isLoading: loadingPay } = useUserPayments(user?.id);
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const expiresAt = plan?.expires_at ? new Date(plan.expires_at) : null;
  const isVip = !!plan?.isVip;

  // Mostra somente pagamentos do Clube
  const clubePayments = payments.filter((p) => p.product_type === 'clube');
  const hasRecurring = clubePayments.some((p) => p.source === 'stripe' && p.status === 'paid');

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-vip-subscription');
      if (error) throw error;
      if (!data?.success) {
        if (data?.error === 'no_subscription') {
          toast({
            title: 'Sem assinatura recorrente',
            description: data.message,
            variant: 'destructive',
          });
        } else {
          throw new Error(data?.error || 'Falha ao cancelar');
        }
      } else {
        toast({
          title: 'Assinatura cancelada',
          description: data.message,
        });
        setConfirmOpen(false);
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Sócio do Clube</h1>
      </div>

      {/* Plano atual */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {loadingPlan ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : isVip ? (
            <>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <p className="font-semibold">Sócio do Clube dos Drinkeros</p>
                <Badge variant="outline" className="ml-auto border-yellow-500/40 text-yellow-500">
                  Ativo
                </Badge>
              </div>
              {expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Renova / expira em {expiresAt.toLocaleDateString('pt-BR')}
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      'https://wa.me/5548991601025?text=Olá! Preciso de ajuda com meu Sócio do Clube.',
                      '_blank'
                    )
                  }
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Falar com suporte
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setConfirmOpen(true)}
                >
                  Cancelar assinatura
                </Button>
              </div>
              {!hasRecurring && (
                <p className="text-xs text-muted-foreground pt-1">
                  Acesso pago manualmente ou por outro canal? Use o botão de suporte para cancelar.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Você não é Sócio do Clube no momento.</p>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4" /> Histórico de pagamentos
          </h2>
          {loadingPay ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
          ) : clubePayments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum pagamento registrado.
            </p>
          ) : (
            <div className="divide-y">
              {clubePayments.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy') : '—'} ·{' '}
                      {sourceLabel[p.source] || p.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold">{fmtBRL(p.amount)}</span>
                    <Badge variant={statusVariant[p.status] || 'secondary'}>
                      {statusLabel[p.status] || p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura do Clube?</AlertDialogTitle>
            <AlertDialogDescription>
              Você manterá o acesso até{' '}
              <strong>{expiresAt ? expiresAt.toLocaleDateString('pt-BR') : 'o fim do período'}</strong>.
              Após isso, perderá receitas exclusivas, Batalha e demais benefícios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelando…
                </>
              ) : (
                'Confirmar cancelamento'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserClubeManage;
