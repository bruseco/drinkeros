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
import { Plus, Trash2, ExternalLink, CreditCard } from 'lucide-react';
import { useVipPayments, useCreateManualVipPayment, useDeleteVipPayment } from '@/hooks/useVipPayments';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
  refunded: 'Reembolsado',
};

const methodLabel: Record<string, string> = {
  card: 'Cartão',
  pix: 'PIX',
  boleto: 'Boleto',
  manual: 'Manual',
};

export const UserPaymentHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: payments = [], isLoading } = useVipPayments(userId);
  const createPayment = useCreateManualVipPayment();
  const deletePayment = useDeleteVipPayment();
  const [open, setOpen] = useState(false);
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

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Histórico VIP</h3>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Registrar pagamento</Button>
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
                <TableHead>Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{p.currency} {p.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{methodLabel[p.payment_method] || p.payment_method}</TableCell>
                  <TableCell><Badge variant={statusVariant[p.status] || 'secondary'}>{statusLabel[p.status] || p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.stripe_charge_id ? (
                      <a href={`https://dashboard.stripe.com/payments/${p.stripe_payment_intent_id || p.stripe_charge_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        Ver <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover pagamento?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePayment.mutate({ id: p.id, userId })}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar pagamento manual</DialogTitle>
              <DialogDescription>Use para vendas offline ou ajustes históricos. Pagamentos via Stripe entram automaticamente.</DialogDescription>
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
      </CardContent>
    </Card>
  );
};
