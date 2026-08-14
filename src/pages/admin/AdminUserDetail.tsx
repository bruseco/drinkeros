import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Mail, Phone, IdCard, Crown, Shield, Calendar, Send, Key, Trash2, Loader2, Pencil, Check, X, BookOpen, FileText, Package, Layers, Sparkles, BarChart3, Bell, BellOff, MapPin, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserDetail } from '@/hooks/useUserDetail';
import { useUpdateUserProfile, useDeleteUser, useResetUserPassword, useResendWelcomeEmail } from '@/hooks/useAdminUsers';
import { useToggleLifetimeAccess } from '@/hooks/useLifetimeAccess';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { UserAccessCard } from '@/components/admin/UserAccessCard';
import { UserPaymentHistory } from '@/components/admin/UserPaymentHistory';
import { AddAccessDialog } from '@/components/admin/AddAccessDialog';

const sourceLabel: Record<string, string> = {
  manual: 'Manual',
  stripe: 'Stripe (renova sozinho)',
  mercadopago: 'Mercado Pago',
  vip_bonus: 'Bônus do Clube',
  legacy_exclusive: 'Acesso legado',
  import: 'Importado',
};

const isAutoRenew = (source?: string) => source === 'stripe';

const AdminUserDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useUserDetail(userId);

  const updateProfile = useUpdateUserProfile();
  const deleteUserMut = useDeleteUser();
  const resetPassword = useResetUserPassword();
  const resendEmail = useResendWelcomeEmail();
  const toggleLifetime = useToggleLifetimeAccess();

  const [editingField, setEditingField] = useState<null | 'name' | 'email' | 'phone' | 'cpf'>(null);
  const [draftValue, setDraftValue] = useState('');

  const [addAccessOpen, setAddAccessOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [editVipOpen, setEditVipOpen] = useState(false);
  const [vipExpiresAt, setVipExpiresAt] = useState('');
  const [vipActivatedAt, setVipActivatedAt] = useState('');

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { profile, role, plan, is_lifetime, courses, ebooks, combos, packages, exclusives, last_sign_in_at, certificates_count, recipe_views_count, push_enabled } = data;

  const isVipActive = !!plan && plan.plan === 'vip' && (!plan.expires_at || new Date(plan.expires_at) > new Date());
  const daysToExpire = plan?.expires_at
    ? Math.ceil((new Date(plan.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const startEdit = (field: 'name' | 'email' | 'phone' | 'cpf', current: string | null) => {
    setEditingField(field);
    setDraftValue(current || '');
  };

  const saveField = async () => {
    if (!editingField || !userId) return;
    if (editingField === 'cpf') {
      const { error } = await supabase.from('profiles').update({ cpf: draftValue || null }).eq('user_id', userId);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'CPF atualizado' });
        queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      }
      setEditingField(null);
      return;
    }
    updateProfile.mutate(
      {
        userId,
        fullName: editingField === 'name' ? draftValue : profile.full_name || '',
        phone: editingField === 'phone' ? draftValue : profile.phone || '',
        email: editingField === 'email' ? draftValue : profile.email,
        originalEmail: profile.email,
      },
      {
        onSuccess: () => {
          setEditingField(null);
          queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
        },
      }
    );
  };

  const handleToggleVip = async (enable: boolean) => {
    const update = enable
      ? { user_id: userId!, plan: 'vip', activated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), source: 'manual' }
      : { user_id: userId!, plan: 'free', expires_at: null, activated_at: new Date().toISOString(), source: 'manual' };
    const { error } = await supabase.from('user_plans').upsert(update, { onConflict: 'user_id' });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      toast({ title: enable ? 'Clube dos Drinkeros ativado por 1 ano' : 'Clube dos Drinkeros removido' });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
    }
  };

  const saveVipPeriod = async () => {
    if (!vipExpiresAt || !vipActivatedAt) return;
    const expires_at = new Date(vipExpiresAt + 'T23:59:59').toISOString();
    const activated_at = new Date(vipActivatedAt + 'T00:00:00').toISOString();
    const { error } = await supabase
      .from('user_plans')
      .update({ expires_at, activated_at })
      .eq('user_id', userId!);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Período do Clube atualizado' });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
      setEditVipOpen(false);
    }
  };

  const renderField = (field: 'name' | 'email' | 'phone' | 'cpf', label: string, value: string | null, icon: React.ReactNode) => (
    <div className="flex items-center gap-3 py-2">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {editingField === field ? (
          <div className="flex items-center gap-2 mt-1">
            <Input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} className="h-8" autoFocus />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveField} disabled={updateProfile.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingField(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="font-medium truncate">{value || <span className="text-muted-foreground italic">não informado</span>}</p>
        )}
      </div>
      {editingField !== field && (
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(field, value)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const excludeIds = {
    courses: courses.map((c) => c.ref_id),
    ebooks: ebooks.map((e) => e.ref_id),
    combos: combos.map((c) => c.ref_id),
    packages: packages.map((p) => p.ref_id),
  };

  const planBadge = role === 'super_admin' || role === 'editor' ? (
    <Badge variant="destructive" className="gap-1"><Shield className="h-3 w-3" /> {role === 'super_admin' ? 'Super Admin' : 'Editor'}</Badge>
  ) : is_lifetime ? (
    <Badge className="gap-1 bg-amber-500 hover:bg-amber-500 text-white"><Crown className="h-3 w-3" /> Vitalício</Badge>
  ) : isVipActive ? (
    <Badge className="gap-1 bg-purple-600 hover:bg-purple-600 text-white"><Sparkles className="h-3 w-3" /> Clube dos Drinkeros</Badge>
  ) : (
    <Badge variant="outline">Free</Badge>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para usuários
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">{(profile.full_name || profile.email)[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.full_name || 'Sem nome'}</h1>
                {planBadge}
                {push_enabled ? (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white">
                    <Bell className="h-3 w-3" /> Notificações ativas
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <BellOff className="h-3 w-3" /> Sem notificações
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{profile.email}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span>Cadastrado em {format(new Date(profile.created_at), 'dd/MM/yyyy')}</span>
                {last_sign_in_at && <span>Último login: {format(new Date(last_sign_in_at), 'dd/MM/yyyy HH:mm')}</span>}
                {profile.last_sign_in_provider && <span>via {profile.last_sign_in_provider}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button size="sm" variant="outline" onClick={() => resendEmail.mutate(userId!)} disabled={resendEmail.isPending} className="gap-2">
                <Send className="h-3.5 w-3.5" /> Reenviar boas-vindas
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setNewPassword(''); setResetOpen(true); }} className="gap-2">
                <Key className="h-3.5 w-3.5" /> Redefinir senha
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir usuário
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação remove permanentemente {profile.email} e todos os seus dados.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteUserMut.mutate(userId!, { onSuccess: () => navigate('/admin/users') })}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal data */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Dados pessoais</h3>
            {renderField('name', 'Nome completo', profile.full_name, <Pencil className="h-4 w-4" />)}
            {renderField('email', 'Email', profile.email, <Mail className="h-4 w-4" />)}
            {renderField('phone', 'Telefone', profile.phone, <Phone className="h-4 w-4" />)}
            {renderField('cpf', 'CPF', profile.cpf, <IdCard className="h-4 w-4" />)}

            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Endereço fiscal (NF-e)
                </h4>
                <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs" onClick={copyFiscalData}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
              {!addressComplete && (
                <p className="text-xs text-destructive mb-1">Endereço incompleto — a NF-e pode ser rejeitada.</p>
              )}
              {renderProfileField('cep', 'CEP', profile.cep)}
              {renderProfileField('address_street', 'Rua / Logradouro', profile.address_street)}
              {renderProfileField('address_number', 'Número', profile.address_number)}
              {renderProfileField('address_complement', 'Complemento', profile.address_complement)}
              {renderProfileField('address_neighborhood', 'Bairro', profile.address_neighborhood)}
              {renderProfileField('address_city', 'Cidade', profile.address_city)}
              {renderProfileField('address_state', 'Estado (UF)', profile.address_state)}
            </div>

            <div className="mt-4 pt-3 border-t">
              <h4 className="text-sm font-semibold mb-1">Outros dados</h4>
              {renderProfileField('birth_date', 'Data de nascimento', profile.birth_date)}
              {renderProfileField('gender', 'Gênero', profile.gender)}
              <div className="py-2">
                <p className="text-xs text-muted-foreground">Interesses</p>
                <p className="font-medium text-sm">
                  {profile.interests?.length ? profile.interests.join(', ') : <span className="text-muted-foreground italic">não informado</span>}
                </p>
              </div>
              <div className="py-2">
                <p className="text-xs text-muted-foreground">Bio</p>
                <p className="font-medium text-sm whitespace-pre-wrap">
                  {profile.bio || <span className="text-muted-foreground italic">não informado</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Plan & Lifetime */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Plano & Acesso</h3>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">Acesso Vitalício</p>
                  <p className="text-xs text-muted-foreground">Remove expiração de todos os acessos</p>
                </div>
              </div>
              <Switch checked={is_lifetime} onCheckedChange={(c) => toggleLifetime.mutate({ userId: userId!, grant: c })} />
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className={isVipActive ? 'h-4 w-4 text-purple-500' : 'h-4 w-4 text-muted-foreground'} />
                  <div>
                    <p className="text-sm font-medium">{isVipActive ? 'Clube dos Drinkeros ativo' : 'Plano Free'}</p>
                    {isVipActive && plan?.activated_at && (
                      <p className="text-xs text-muted-foreground">Início: {format(new Date(plan.activated_at), 'dd/MM/yyyy')}</p>
                    )}
                    {isVipActive && plan?.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Expira em {format(new Date(plan.expires_at), 'dd/MM/yyyy')}
                        {daysToExpire !== null && daysToExpire >= 0 && (
                          <span className={daysToExpire <= 30 ? ' text-amber-600 font-medium' : ''}>
                            {' '}({daysToExpire} {daysToExpire === 1 ? 'dia' : 'dias'})
                          </span>
                        )}
                        {daysToExpire !== null && daysToExpire < 0 && (
                          <span className="text-destructive font-medium"> (vencida)</span>
                        )}
                      </p>
                    )}
                    {isVipActive && plan?.source && (
                      <p className="text-xs text-muted-foreground">
                        Origem: {sourceLabel[plan.source] || plan.source}
                        {!isAutoRenew(plan.source) && (
                          <span className="ml-1 text-amber-600">• Renovação manual</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <Switch checked={isVipActive} onCheckedChange={handleToggleVip} />
              </div>
              {isVipActive && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => {
                  setVipExpiresAt(plan?.expires_at?.slice(0, 10) || '');
                  setVipActivatedAt(plan?.activated_at?.slice(0, 10) || '');
                  setEditVipOpen(true);
                }}>
                  <Calendar className="h-3.5 w-3.5 mr-1" /> Editar período do Clube
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Atividade</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{recipe_views_count}</p>
              <p className="text-xs text-muted-foreground">Receitas visualizadas</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{certificates_count}</p>
              <p className="text-xs text-muted-foreground">Certificados emitidos</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{courses.length}</p>
              <p className="text-xs text-muted-foreground">Cursos ativos</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{ebooks.length}</p>
              <p className="text-xs text-muted-foreground">E-books ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content access tabs */}
      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses" className="gap-2"><BookOpen className="h-3.5 w-3.5" /> Cursos ({courses.length})</TabsTrigger>
          <TabsTrigger value="ebooks" className="gap-2"><FileText className="h-3.5 w-3.5" /> E-books ({ebooks.length})</TabsTrigger>
          <TabsTrigger value="exclusives" className="gap-2"><Sparkles className="h-3.5 w-3.5" /> Conteúdo Exclusivo ({exclusives.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="courses">
          <UserAccessCard title="Cursos" table="user_courses" items={courses} onAdd={() => setAddAccessOpen(true)} />
        </TabsContent>
        <TabsContent value="ebooks">
          <UserAccessCard title="E-books" table="user_ebooks" items={ebooks} onAdd={() => setAddAccessOpen(true)} />
        </TabsContent>
        <TabsContent value="exclusives">
          <UserAccessCard
            title="Conteúdo Exclusivo"
            table="user_exclusive_access"
            items={exclusives}
            onAdd={async () => {
              if (exclusives.some((e) => e.ref_id === 'receitas')) {
                toast({ title: 'Aluno já tem acesso às Receitas Exclusivas' });
                return;
              }
              const expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
              const { error } = await supabase
                .from('user_exclusive_access')
                .insert({ user_id: userId!, feature: 'receitas', expires_at });
              if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
              else {
                toast({ title: 'Acesso a Receitas Exclusivas concedido por 1 ano' });
                queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] });
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* VIP payments */}
      <UserPaymentHistory userId={userId!} />

      {/* Add access dialog */}
      <AddAccessDialog open={addAccessOpen} onOpenChange={setAddAccessOpen} userId={userId!} excludeIds={excludeIds} />

      {/* Reset password */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para {profile.email}. Comunique diretamente ao aluno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nova senha</Label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button onClick={() => resetPassword.mutate({ userId: userId!, newPassword }, { onSuccess: () => setResetOpen(false) })} disabled={newPassword.length < 6 || resetPassword.isPending}>
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit VIP expiration */}
      <Dialog open={editVipOpen} onOpenChange={setEditVipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar período do Clube dos Drinkeros</DialogTitle>
            <DialogDescription>
              Ajuste o início e a expiração do acesso. A régua de avisos de renovação será reiniciada automaticamente para a nova data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input type="date" value={vipActivatedAt} onChange={(e) => setVipActivatedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de expiração</Label>
              <Input type="date" value={vipExpiresAt} onChange={(e) => setVipExpiresAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVipOpen(false)}>Cancelar</Button>
            <Button onClick={saveVipPeriod} disabled={!vipExpiresAt || !vipActivatedAt}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserDetail;
