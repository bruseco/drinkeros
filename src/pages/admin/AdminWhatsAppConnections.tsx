import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Phone, ArrowLeft, Wifi, WifiOff, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface ZapiConnection {
  id: string;
  name: string;
  instance_id: string | null;
  token: string | null;
  security_token: string | null;
  phone_number: string;
  is_active: boolean;
  connection_status: string;
  last_status_at: string | null;
  last_disconnect_reason: string | null;
  daily_new_contact_limit: number;
  new_contacts_today: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
  provider: string;
  api_url: string | null;
  instance_name: string | null;
  waba_id: string | null;
}

function useConnections() {
  return useQuery({
    queryKey: ['zapi-connections'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('zapi_connections')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ZapiConnection[];
    },
  });
}

const emptyForm = {
  name: '',
  provider: 'zapi' as string,
  instance_id: '',
  token: '',
  security_token: '',
  phone_number: '',
  daily_new_contact_limit: 100,
  is_active: true,
  waba_id: '',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getWebhookUrl = (connectionId: string) =>
  `${SUPABASE_URL}/functions/v1/whatsapp-webhook?connection_id=${connectionId}`;

const getStatusWebhookUrl = (connectionId: string) =>
  `${SUPABASE_URL}/functions/v1/whatsapp-status-webhook?connection_id=${connectionId}`;

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado!`);
};

const AdminWhatsAppConnections: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: connections = [], isLoading } = useConnections();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const { id, ...fields } = data;
      const payload: Record<string, any> = {
        name: fields.name,
        phone_number: fields.phone_number,
        is_active: fields.is_active,
        provider: fields.provider,
      };

      if (fields.provider === 'zapi') {
        payload.instance_id = fields.instance_id;
        payload.token = fields.token;
        payload.security_token = fields.security_token;
        payload.daily_new_contact_limit = fields.daily_new_contact_limit;
        payload.api_url = null;
        payload.instance_name = null;
      } else {
        // era_cloud
        payload.instance_id = null;
        payload.token = fields.token; // API Key
        payload.security_token = fields.security_token; // Verify Token
        payload.api_url = fields.instance_id; // Reusing instance_id form field for api_url
        payload.instance_name = null;
        payload.daily_new_contact_limit = 9999;
        payload.waba_id = fields.waba_id || null;
      }

      if (id) {
        payload.updated_at = new Date().toISOString();
        const { error } = await (supabase.from as any)('zapi_connections')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)('zapi_connections')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapi-connections'] });
      toast.success(editingId ? 'Conexão atualizada' : 'Conexão criada');
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from as any)('zapi_connections')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zapi-connections'] });
      toast.success('Status atualizado');
    },
  });

  const openEdit = (conn: ZapiConnection) => {
    setEditingId(conn.id);
    setForm({
      name: conn.name,
      provider: conn.provider || 'zapi',
      instance_id: conn.provider === 'era_cloud' ? (conn.api_url || '') : (conn.instance_id || ''),
      token: conn.token || '',
      security_token: conn.security_token || '',
      phone_number: conn.phone_number,
      daily_new_contact_limit: conn.daily_new_contact_limit,
      is_active: conn.is_active,
      waba_id: conn.waba_id || '',
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const zapiConnections = connections.filter(c => (c.provider || 'zapi') === 'zapi');
  const totalNewToday = zapiConnections.reduce((sum, c) => sum + c.new_contacts_today, 0);
  const totalLimit = zapiConnections.reduce((sum, c) => sum + c.daily_new_contact_limit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/whatsapp">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Conexões WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Gerencie instâncias Z-API e Era Cloud (WhatsApp Business) para envio de mensagens</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova Conexão</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Conexão' : 'Nova Conexão'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingId && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Webhook de Mensagens</Label>
                    <div className="flex gap-2">
                      <Input value={getWebhookUrl(editingId)} readOnly className="text-xs font-mono" />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(getWebhookUrl(editingId), 'URL do webhook de mensagens')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {form.provider === 'era_cloud' && (
                      <p className="text-xs text-muted-foreground">
                        Configure esta URL no painel Era Cloud → Forwarding Webhook. O Verify Token deve ser o mesmo configurado abaixo.
                      </p>
                    )}
                  </div>
                  {form.provider === 'zapi' && (
                    <div className="space-y-1">
                      <Label>Webhook de Status (Connected/Disconnected)</Label>
                      <div className="flex gap-2">
                        <Input value={getStatusWebhookUrl(editingId)} readOnly className="text-xs font-mono" />
                        <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(getStatusWebhookUrl(editingId), 'URL do webhook de status')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Configure esta URL nos campos "Connected" e "Disconnected" do Z-API.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Provedor</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zapi">Z-API</SelectItem>
                    <SelectItem value="era_cloud">Era Cloud (WhatsApp Business)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="WhatsApp 1" required />
              </div>
              <div>
                <Label>Número do WhatsApp</Label>
                <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="5511999999999" required />
              </div>

              {form.provider === 'zapi' ? (
                <>
                  <div>
                    <Label>Instance ID (Z-API)</Label>
                    <Input value={form.instance_id} onChange={(e) => setForm({ ...form, instance_id: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Token (Z-API)</Label>
                    <Input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Security Token (Z-API)</Label>
                    <Input value={form.security_token} onChange={(e) => setForm({ ...form, security_token: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Limite diário de novos contatos</Label>
                    <Input type="number" value={form.daily_new_contact_limit} onChange={(e) => setForm({ ...form, daily_new_contact_limit: parseInt(e.target.value) || 100 })} min={1} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>URL da API</Label>
                    <Input value={form.instance_id} onChange={(e) => setForm({ ...form, instance_id: e.target.value })} placeholder="Ex: https://waba-v1.eracloud.com.br" required />
                  </div>
                  <div>
                    <Label>API Key</Label>
                    <Input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="Encontrada em Configurações da instância" required />
                  </div>
                  <div>
                    <Label>WABA ID</Label>
                    <Input value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} placeholder="Ex: 318173658212345" required />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary - only for Z-API connections */}
      {zapiConnections.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uso Diário Total (Z-API)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Progress value={totalLimit > 0 ? (totalNewToday / totalLimit) * 100 : 0} className="flex-1" />
              <span className="text-sm font-medium whitespace-nowrap">
                {totalNewToday} / {totalLimit} novos contatos
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {zapiConnections.filter(c => c.is_active).length} conexões Z-API ativas · {connections.filter(c => c.provider === 'era_cloud' && c.is_active).length} conexões Era Cloud ativas
            </p>
          </CardContent>
        </Card>
      )}

      {/* Connections Table */}
      {isLoading ? (
        <p className="text-center text-muted-foreground">Carregando...</p>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-medium text-foreground mb-1">Nenhuma conexão configurada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              O sistema está usando as credenciais Z-API das variáveis de ambiente como fallback.
            </p>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Adicionar Conexão</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Uso Diário</TableHead>
                <TableHead>Limite</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((conn) => {
                const provider = conn.provider || 'zapi';
                const isEraCloud = provider === 'era_cloud';
                const usagePct = !isEraCloud && conn.daily_new_contact_limit > 0
                  ? (conn.new_contacts_today / conn.daily_new_contact_limit) * 100
                  : 0;
                return (
                  <TableRow key={conn.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-xs">
                          {isEraCloud ? 'Era Cloud' : 'Z-API'}
                        </Badge>
                        {conn.connection_status === 'connected' ? (
                          <Badge className="bg-green-600 text-white w-fit"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>
                        ) : conn.connection_status === 'disconnected' ? (
                          <Badge variant="destructive" className="w-fit"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>
                        ) : conn.is_active ? (
                          <Badge variant="secondary" className="w-fit"><Wifi className="h-3 w-3 mr-1" />Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="w-fit"><WifiOff className="h-3 w-3 mr-1" />Inativo</Badge>
                        )}
                      </div>
                      {conn.last_disconnect_reason && conn.connection_status === 'disconnected' && (
                        <p className="text-xs text-destructive mt-1">{conn.last_disconnect_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{conn.name}</TableCell>
                    <TableCell className="text-muted-foreground">{conn.phone_number}</TableCell>
                    <TableCell>
                      {isEraCloud ? (
                        <span className="text-xs text-muted-foreground">Ilimitado</span>
                      ) : (
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Progress value={usagePct} className="flex-1 h-2" />
                          <span className="text-xs whitespace-nowrap">{conn.new_contacts_today}/{conn.daily_new_contact_limit}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEraCloud ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        `${conn.daily_new_contact_limit}/dia`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Copiar URL do webhook" onClick={() => copyToClipboard(getWebhookUrl(conn.id), 'URL do webhook')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={conn.is_active}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: conn.id, is_active: v })}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(conn)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Como configurar os webhooks</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div>
            <p className="font-medium text-foreground mb-1">Z-API</p>
            <p>Configure o webhook de mensagens e os callbacks de Connected/Disconnected com as URLs da conexão.</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Era Cloud (WhatsApp Business)</p>
            <p>No painel Era Cloud, configure o Forwarding Webhook com a URL de mensagens e o Verify Token definido na conexão. Inscreva-se nos campos: <code className="bg-muted px-1 rounded text-xs">messages</code>, <code className="bg-muted px-1 rounded text-xs">message_deliveries</code>.</p>
          </div>
          <code className="block bg-muted p-2 rounded text-xs break-all">
            {`${SUPABASE_URL}/functions/v1/whatsapp-webhook?connection_id=<ID_DA_CONEXÃO>`}
          </code>
          <p>Ao editar uma conexão, as URLs dos webhooks aparecem prontas para copiar.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWhatsAppConnections;
