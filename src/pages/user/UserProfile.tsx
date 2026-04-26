import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Save, Eye, EyeOff, LogOut, MessageCircle, ChevronDown, ChevronRight, Package, Camera } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { MyProductsSection } from '@/components/user/MyProductsSection';

const ProfileDataSection: React.FC = () => {
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cpfLocked, setCpfLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    const fetchExtra = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('phone, cpf, bio').eq('user_id', user.id).single();
      if (data?.phone) setPhone(data.phone);
      if (data?.bio) setBio(data.bio);
      if (data?.cpf) {
        const d = data.cpf;
        setCpf(d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : d);
        setCpfLocked(true);
      }
    };
    fetchExtra();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file);
      if (upErr) throw upErr;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
      toast.success('Foto atualizada!');
      window.location.reload();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = { full_name: fullName.trim(), phone: phone.trim() || null, bio: bio.trim() || null };
      if (!cpfLocked && cpf.replace(/\D/g, '').length === 11) updateData.cpf = cpf.replace(/\D/g, '');
      const { error } = await supabase.from('profiles').update(updateData).eq('user_id', user.id);
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar perfil: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const initial = (fullName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            aria-label="Trocar foto"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        {uploadingAvatar && <p className="text-xs text-muted-foreground">Enviando foto...</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Sobre você</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Fale um pouco sobre você (aparece no Clube)" rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cpf">CPF</Label>
        <Input
          id="cpf"
          value={cpf}
          onChange={(e) => {
            if (cpfLocked) return;
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            let formatted = digits;
            if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`;
            if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
            if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
            setCpf(formatted);
          }}
          placeholder="000.000.000-00"
          maxLength={14}
          disabled={cpfLocked}
          className={cpfLocked ? 'opacity-60' : ''}
        />
        {cpfLocked && <p className="text-xs text-muted-foreground">O CPF não pode ser alterado após o cadastro.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" value={user?.email || ''} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">O e-mail está vinculado ao seu login e não pode ser alterado.</p>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Salvando...' : 'Salvar Dados'}
      </Button>
    </div>
  );
};

const ChangePasswordSection: React.FC = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = async () => {
    if (!newPassword || !confirmPassword) { toast.error('Preencha todos os campos de senha.'); return; }
    if (newPassword.length < 6) { toast.error('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem.'); return; }
    if (!currentPassword) { toast.error('Informe a senha atual.'); return; }

    setSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword });
      if (signInError) { toast.error('Senha atual incorreta.'); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error('Erro ao alterar senha: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const PasswordInput = ({ id, value, onChange, show, toggleShow, placeholder }: any) => (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={toggleShow}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <Label>Senha atual</Label>
        <PasswordInput id="cur" value={currentPassword} onChange={(e: any) => setCurrentPassword(e.target.value)} show={showCurrent} toggleShow={() => setShowCurrent(!showCurrent)} placeholder="••••••••" />
      </div>
      <Separator />
      <div className="space-y-2">
        <Label>Nova senha</Label>
        <PasswordInput id="new" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} show={showNew} toggleShow={() => setShowNew(!showNew)} placeholder="Mínimo 6 caracteres" />
      </div>
      <div className="space-y-2">
        <Label>Confirmar nova senha</Label>
        <PasswordInput id="conf" value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} show={showConfirm} toggleShow={() => setShowConfirm(!showConfirm)} placeholder="Repita a nova senha" />
      </div>
      <Button onClick={handleChange} disabled={saving} className="w-full">
        <Lock className="mr-2 h-4 w-4" />
        {saving ? 'Alterando...' : 'Alterar Senha'}
      </Button>
    </div>
  );
};

const UserProfile: React.FC = () => {
  const { signOut } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (key: string) => setOpenSection(prev => prev === key ? null : key);

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-2">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie seus dados pessoais e senha.</p>
      </div>

      {/* Dados Pessoais - collapsible */}
      <Collapsible open={openSection === 'dados'} onOpenChange={() => toggle('dados')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <User className="h-5 w-5 text-muted-foreground" />
            Dados Pessoais
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'dados' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <ProfileDataSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Produtos adquiridos - collapsible */}
      <Collapsible open={openSection === 'produtos'} onOpenChange={() => toggle('produtos')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <Package className="h-5 w-5 text-muted-foreground" />
            Produtos Adquiridos
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'produtos' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <MyProductsSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Alterar Senha - collapsible */}
      <Collapsible open={openSection === 'senha'} onOpenChange={() => toggle('senha')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Alterar Senha
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'senha' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <ChangePasswordSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Suporte WhatsApp - action button */}
      <button
        onClick={() => window.open('https://wa.me/5548991601025', '_blank')}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center gap-3 text-sm font-medium">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          Suporte via WhatsApp
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Sair */}
      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-card px-4 h-14 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
      >
        <LogOut className="h-5 w-5" />
        Sair da Conta
      </button>
    </div>
  );
};

export default UserProfile;
