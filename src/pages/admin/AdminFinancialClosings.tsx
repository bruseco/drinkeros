import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { RandReport } from '../../../supabase/functions/_shared/randClosing';

type Closing = {
  month: string;
  status: 'draft' | 'paid' | 'carried';
  draft_id: string;
  synced_at: string;
  paid_at: string | null;
  carried_to: string | null;
  report: RandReport;
  buyer_names?: Record<string, string>;
};
type ClosingDatabase = { public: Omit<Database['public'], 'Tables' | 'Functions'> & {
  Tables: Database['public']['Tables'] & { rand_financial_closings: {
    Row: Closing; Insert: never; Update: never; Relationships: [];
  } };
  Functions: Database['public']['Functions'] & { mark_rand_closing_paid: {
    Args: { p_month: string; p_draft_id: string }; Returns: Closing;
  }; view_rand_closings: { Args: Record<string, never>; Returns: Closing[] } };
} };
const db = supabase as unknown as SupabaseClient<ClosingDatabase>;
const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = (month: string) => new Date(`${month.slice(0, 7)}-15T12:00:00-03:00`)
  .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const dateLabel = (date: string) => new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const todayBR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
function suggestedMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const date = new Date(Date.UTC(get('year'), get('month') - (get('day') >= 5 ? 2 : 3), 15));
  return date.toISOString().slice(0, 7);
}
function availableOn(month: string) {
  const [year, num] = month.split('-').map(Number);
  return `${num === 12 ? year + 1 : year}-${String(num === 12 ? 1 : num + 1).padStart(2, '0')}-05`;
}

export default function AdminFinancialClosings({ readOnly = false }: { readOnly?: boolean }) {
  const { isSuperAdmin, user } = useAuth();
  const [month, setMonth] = useState(suggestedMonth);
  const [confirm, setConfirm] = useState<Closing | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['rand-closings', readOnly ? user?.id : 'admin'], enabled: readOnly ? !!user : isSuperAdmin,
    queryFn: async (): Promise<Closing[]> => {
      if (readOnly) {
        const { data, error } = await db.rpc('view_rand_closings', {});
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await db.from('rand_financial_closings').select('*').order('month', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const visiblePayments = query.data?.find(c => c.month.slice(0, 7) === month)?.report.lines.map(l => l.payment_id) ?? [];
  const buyers = useQuery({
    queryKey: ['rand-closing-buyers', user?.id, month, visiblePayments],
    enabled: !readOnly && isSuperAdmin && visiblePayments.length > 0,
    queryFn: async () => {
      const names: Record<string, string> = {};
      for (let offset = 0; offset < visiblePayments.length; offset += 200) {
        const { data: purchases, error } = await supabase.from('purchases')
          .select('transaction_id,buyer_name,user_id').eq('gateway', 'mercado_pago')
          .eq('product_type', 'combo').in('transaction_id', visiblePayments.slice(offset, offset + 200));
        if (error) throw error;
        const missing = [...new Set((purchases ?? []).filter(p => !p.buyer_name?.trim()).map(p => p.user_id).filter(Boolean))];
        const profiles = new Map<string, string>();
        if (missing.length) {
          const { data, error: profileError } = await supabase.from('profiles')
            .select('user_id,full_name').in('user_id', missing);
          if (profileError) throw profileError;
          for (const profile of data ?? []) if (profile.full_name?.trim()) profiles.set(profile.user_id, profile.full_name.trim());
        }
        for (const purchase of purchases ?? []) {
          const name = purchase.buyer_name?.trim() || profiles.get(purchase.user_id);
          if (name) names[purchase.transaction_id] = name;
        }
      }
      return names;
    },
  });
  const buyerName = (paymentId: string) => readOnly
    ? query.data?.find(c => c.month.slice(0, 7) === month)?.buyer_names?.[paymentId] || 'Nome não disponível'
    : buyers.isLoading ? 'Carregando nome…' : buyers.data?.[paymentId] || 'Nome não disponível';
  const refundStyle = 'text-orange-600 dark:text-orange-400';
  const refresh = useMutation({
    mutationFn: async (selectedMonth: string) => {
      if (readOnly) throw new Error('Acesso somente para visualização.');
      const { data, error } = await supabase.functions.invoke('rand-financial-closing', { body: { month: selectedMonth } });
      if (error) {
        const details = await error.context?.json?.().catch(() => null);
        throw new Error(details?.error || 'Não foi possível consultar o Mercado Pago. Tente novamente.');
      }
      if (data?.error || !data?.closing) throw new Error(data?.error || 'Resposta incompleta.');
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['rand-closings'] }); toast.success('Demonstrativo atualizado com os valores do Mercado Pago.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const markPaid = useMutation({
    mutationFn: async (closing: Closing) => {
      if (readOnly) throw new Error('Acesso somente para visualização.');
      const { error } = await db.rpc('mark_rand_closing_paid', { p_month: closing.month, p_draft_id: closing.draft_id });
      if (error) throw error;
    },
    onSuccess: () => { setConfirm(null); client.invalidateQueries({ queryKey: ['rand-closings'] }); toast.success('Fechamento marcado como acertado.'); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!readOnly && !isSuperAdmin) return <Navigate to="/admin" replace />;
  const closing = query.data?.find(c => c.month.slice(0, 7) === month);
  const report = closing?.report;
  const paid = closing != null && closing.status !== 'draft';
  const eligible = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) && todayBR() >= availableOn(month);
  const stale = !closing || Date.now() - new Date(closing.synced_at).getTime() > 10 * 60 * 1000;
  const adjustments = report?.lines.filter(l => l.adjustment) ?? [];
  const sales = report?.lines.filter(l => !l.adjustment) ?? [];

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-center gap-3"><FileText className="h-7 w-7 text-primary" />
      <div>{!readOnly && <Link to="/admin/fechamentos" className="text-sm text-muted-foreground hover:text-primary">← Todos os parceiros</Link>}
        <h1 className="text-2xl font-bold sm:text-3xl">Fechamento RAND</h1>
        <p className="text-muted-foreground">RAND · demonstrativo mensal e controle dos repasses</p></div>
    </div>
    <Card><CardContent className="flex flex-wrap items-end gap-4 pt-6">
      <div className="space-y-2"><Label htmlFor="closing-month">Mês do pagamento do cliente</Label>
        <Input id="closing-month" type="month" value={month} onChange={e => { setMonth(e.target.value); setConfirm(null); refresh.reset(); }} /></div>
      {!readOnly && <Button variant="outline" disabled={!month || paid || refresh.isPending || markPaid.isPending} onClick={() => refresh.mutate(month)}>
        {refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {refresh.isPending ? 'Consultando Mercado Pago…' : 'Atualizar demonstrativo'}</Button>}
      {closing && <Badge variant={paid ? 'default' : 'secondary'}>{closing.status === 'carried' ? 'Compensado' : paid ? 'Acertado' : 'Pendente'}</Badge>}
    </CardContent></Card>
    <p className="text-sm text-muted-foreground">Somente vendas do combo RAND. Datas no horário de Brasília. O fechamento fica disponível no dia 5 do mês seguinte.</p>
    {query.isLoading && <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando fechamentos" />}
    {query.isError && <Alert variant="destructive"><AlertDescription>Não foi possível carregar os fechamentos.
      <Button variant="link" onClick={() => query.refetch()}>Tentar novamente</Button></AlertDescription></Alert>}
    {refresh.isError && <Alert variant="destructive"><AlertDescription>{refresh.error.message} O fechamento não pode ser acertado até uma atualização completa.</AlertDescription></Alert>}
    {!closing && !query.isLoading && !query.isError && <Card><CardContent className="py-10 text-center text-muted-foreground">
      Atualize o demonstrativo para consultar as vendas, taxas e estornos de {month ? monthLabel(month) : 'um mês'}.
    </CardContent></Card>}
    {report && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Faturamento bruto', report.gross_cents], ['Saldo líquido', report.net_cents],
          ['RAND · 60%', report.rand_cents], ['Drinkeros · 40%', report.drinkeros_cents]].map(([label, value]) =>
          <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{brl(Number(value))}</CardContent></Card>)}
      </div>
      <Card><CardHeader><CardTitle>Demonstrativo · {monthLabel(month)}</CardTitle></CardHeader><CardContent>
        <dl className="space-y-3 text-sm">
          {[
            ['Faturamento bruto', report.gross_cents], ['Estornos do período', -report.refund_cents],
            ['Faturamento após estornos · base do imposto', report.tax_base_cents],
            ['Taxas reais de Pix', -report.pix_fee_cents], ['Taxas reais de cartão', -report.card_fee_cents],
            ['Imposto · 7% sobre o faturamento após estornos', -report.tax_cents],
            ['Ajustes de períodos anteriores', report.adjustments_cents], ['Saldo líquido para divisão', report.net_cents],
          ].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b pb-2">
            <dt>{label}</dt><dd className="whitespace-nowrap font-medium">{brl(Number(value))}</dd></div>)}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">{report.sales_count} vendas com saldo · {report.refund_count} vendas com estorno neste mês.
          Taxas consultadas em {dateLabel(closing.synced_at)}. Ajustes também consideram devoluções de taxas informadas pelo Mercado Pago.</p>
        {closing.status === 'carried' ? <p className="mt-4 text-sm">Saldo compensado no fechamento de {monthLabel(closing.carried_to!)}.</p> : paid ? <p className="mt-4 flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />
          Acertado em {dateLabel(closing.paid_at!)}. Este demonstrativo está preservado; alterações posteriores entram no próximo fechamento.</p>
          : readOnly ? <p className="mt-4 text-sm text-muted-foreground">Fechamento pendente. A atualização e o registro dos repasses são feitos pela administração.</p> : <div className="mt-5 space-y-3">
            {!eligible && <p className="text-sm text-muted-foreground">Disponível para acerto a partir de {availableOn(month).split('-').reverse().join('/')}.</p>}
            {stale && <p className="text-sm text-muted-foreground">Atualize os dados antes de marcar como acertado.</p>}
            {report.net_cents < 0 && <Alert><AlertDescription>Os ajustes superaram as vendas. Mantenha este mês pendente para compensar o saldo no próximo fechamento.</AlertDescription></Alert>}
            <Button disabled={!eligible || stale || refresh.isPending || refresh.isError || markPaid.isPending || report.net_cents < 0} onClick={() => setConfirm(closing)}>
              {markPaid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Marcar como acertado</Button>
            <p className="text-xs text-muted-foreground">Esse botão registra que os repasses foram feitos. Ele não transfere dinheiro.</p>
          </div>}
      </CardContent></Card>
      {adjustments.length > 0 && <Card><CardHeader><CardTitle>Ajustes de períodos anteriores</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Mês original</TableHead><TableHead>Comprador</TableHead><TableHead>Pagamento</TableHead><TableHead className="text-right">Ajuste líquido</TableHead></TableRow></TableHeader>
          <TableBody>{adjustments.map(l => <TableRow key={l.payment_id} className={l.refund_cents > 0 ? refundStyle : undefined}><TableCell>{monthLabel(l.original_month)}{l.carried && <span className="block text-xs text-muted-foreground">Saldo de mês pendente</span>}</TableCell>
            <TableCell className="min-w-40 font-medium">{buyerName(l.payment_id)}</TableCell>
            <TableCell>{l.payment_id}</TableCell><TableCell className="text-right">{brl(l.delta_cents)}</TableCell></TableRow>)}</TableBody></Table>
      </CardContent></Card>}
      <Card><CardHeader><CardTitle>Vendas e estornos do mês</CardTitle></CardHeader><CardContent>
        {buyers.isError && <p role="alert" className="mb-3 text-sm text-muted-foreground">Não foi possível carregar os nomes dos compradores. <Button variant="link" onClick={() => buyers.refetch()}>Tentar novamente</Button></p>}
        <Table><TableHeader><TableRow><TableHead>Comprador</TableHead><TableHead>Pagamento</TableHead><TableHead>Data</TableHead><TableHead>Meio</TableHead>
          <TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Estorno</TableHead><TableHead className="text-right">Taxa</TableHead></TableRow></TableHeader>
          <TableBody>{sales.map(l => <TableRow key={l.payment_id} className={l.refund_cents > 0 ? refundStyle : undefined}>
            <TableCell className="min-w-40 font-medium">{buyerName(l.payment_id)}{l.refund_cents > 0 && <span className="mt-1 block text-xs font-semibold text-orange-700 dark:text-orange-300">{l.refund_cents < l.gross_cents ? 'Estorno parcial' : 'Estornado'}</span>}</TableCell>
            <TableCell>{l.payment_id}</TableCell><TableCell className="whitespace-nowrap">{dateLabel(l.paid_at)}</TableCell>
            <TableCell>{l.method === 'pix' ? 'Pix' : 'Cartão'}</TableCell><TableCell className="text-right whitespace-nowrap">{brl(l.gross_cents)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{brl(l.refund_cents)}</TableCell><TableCell className="text-right whitespace-nowrap">{brl(l.fee_cents)}</TableCell></TableRow>)}</TableBody></Table>
        {!sales.length && <p className="py-4 text-sm text-muted-foreground">Sem pagamentos RAND neste mês.</p>}
      </CardContent></Card>
    </>}
    <Card><CardHeader><CardTitle>Histórico de fechamentos</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>Status</TableHead><TableHead className="text-right">RAND</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{query.data?.map(c => <TableRow key={c.month}><TableCell>{monthLabel(c.month)}</TableCell><TableCell>{c.status === 'carried' ? 'Compensado' : c.status === 'paid' ? 'Acertado' : 'Pendente'}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{brl(c.report.rand_cents)}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => { setMonth(c.month.slice(0, 7)); refresh.reset(); }}>Abrir</Button></TableCell></TableRow>)}</TableBody></Table>
      {!query.data?.length && <p className="py-4 text-sm text-muted-foreground">Nenhum fechamento registrado.</p>}
    </CardContent></Card>
    <AlertDialog open={!!confirm} onOpenChange={open => { if (!open && !markPaid.isPending) setConfirm(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar os repasses de {confirm && monthLabel(confirm.month)}?</AlertDialogTitle>
        <AlertDialogDescription>Confirme apenas se os valores já foram acertados: RAND {confirm && brl(confirm.report.rand_cents)} e Drinkeros {confirm && brl(confirm.report.drinkeros_cents)}.
          O demonstrativo será preservado e estornos posteriores serão ajustados no próximo fechamento.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={markPaid.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={markPaid.isPending} onClick={e => { e.preventDefault(); if (confirm) markPaid.mutate(confirm); }}>
            {markPaid.isPending ? 'Registrando…' : 'Os repasses foram acertados'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
