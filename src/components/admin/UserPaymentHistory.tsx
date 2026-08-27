import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ExternalLink, CreditCard, Undo2 } from 'lucide-react';
import { useCreateManualVipPayment, useDeleteVipPayment } from '@/hooks/useVipPayments';
import { useUserPayments, useRefundPayment, type UserPaymentRow } from '@/hooks/useUserPayments';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  pending: 'secondary',
  failed: 'destructive',
  refunded: 'outline',
};

const statusLabel: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  failed: 'Falhou',
  refunded: 'Estornado',
};

const sourceLabel: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  manual: 'Manual',
  import: 'Importação',
  vip_bonus: 'Bônus',
};

const productTypeLabel: Record<string, string> = {
  clube: 'Clube',
  curso: 'Curso',
  combo: 'Combo',
  ebook: 'Ebook',
  pacote: 'Módulo',
};

const fmtBRL = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const UserPaymentHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: payments = [], isLoading } = useUserPayments(userId);
  const createPayment = useCreateManualVipPayment();
  const deletePayment = useDeleteVipPayment();
  const refundPayment = useRefundPayment();
  const [open, setOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<UserPaymentRow | null>(null);
  const [amount, setAmount] = useState('69.00');
  const [method, setMethod] = useState('manual');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const handleCreate = () => {
    createPayment.mutate(
      { userId, amount: parseFloat(amount), paymentMethod: method, paidAt: new Date(paidAt + 'T12:00:00').toISOString(), notes: notes || undefined },
      { onSuccess: () => { setOpen(false); setNotes(''); } }
    );
  };

  const handleConfirmRefund = () => {
    if (!refundTarget) return;
    refundPayment.mutate(
      { table: refundTarget.table, recordId: refundTarget.rawId, userId },
      { onSuccess: () => setRefundTarget(null) }
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Histórico de pagamentos
          </h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar pagamento
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pagamento registrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const canRefund =
                  p.status === 'paid' &&
                  !p.refunded_at &&
                  (p.source === 'mercadopago' || p.table === 'vip_payments');
                const externalUrl =
                  p.source === 'mercadopago' && p.external_ref
                    ? `https://www.mercadopago.com.br/activities/detail/${p.external_ref}`
                    : null;

                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.product_name}</span>
                        <span className="text-xs text-muted-foreground">{productTypeLabel[p.product_type] || p.product_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{fmtBRL(p.amount)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <span>{sourceLabel[p.source] || p.source}</span>
                        {externalUrl && (
                          <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status] || 'secondary'}>
                        {statusLabel[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canRefund && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-amber-600 hover:text-amber-600"
                            title="Estornar pagamento"
                            onClick={() => setRefundTarget(p)}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {p.table === 'vip_payments' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Remover registro">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover pagamento?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita. Não cancela o pagamento no provedor.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePayment.mutate({ id: p.rawId, userId })}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Manual payment dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar pagamento manual</DialogTitle>
              <DialogDescription>Use para vendas offline ou ajustes históricos do Clube. Pagamentos via Mercado Pago entram automaticamente.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor (BRL)</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data do pagamento</Label>
                  <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: pago via transferência bancária" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!amount || createPayment.isPending}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Refund confirmation dialog */}
        <Dialog open={!!refundTarget} onOpenChange={(v) => !v && setRefundTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar estorno</DialogTitle>
              <DialogDescription>
                O estorno será processado diretamente no provedor de pagamento e o acesso do produto será removido.
              </DialogDescription>
            </DialogHeader>
            {refundTarget && (
              <div className="space-y-2 py-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Produto:</span>
                  <span className="font-medium">{refundTarget.product_name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-medium">{fmtBRL(refundTarget.amount)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Provedor:</span>
                  <span className="font-medium">{sourceLabel[refundTarget.source] || refundTarget.source}</span>
                </div>
                {refundTarget.external_ref && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Transação:</span>
                    <span className="font-mono text-xs">{refundTarget.external_ref}</span>
                  </div>
                )}
                {refundTarget.source !== 'mercadopago' && (
                  <p className="text-xs text-amber-600 pt-2">
                    Pagamento sem provedor externo: o estorno será apenas registrado, sem chamar nenhum gateway.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={refundPayment.isPending}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmRefund}
                disabled={refundPayment.isPending}
              >
                {refundPayment.isPending ? 'Processando…' : 'Confirmar estorno'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
