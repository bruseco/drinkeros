import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Save, Eye, EyeOff, LogOut, MessageCircle, ChevronDown, ChevronRight, Package, Camera, Crown, Bell, BellOff, Shield, ArrowLeftRight, Heart, Briefcase, PartyPopper, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useInterests, useUpdateInterests, type Interest } from '@/hooks/useInterests';

import { isAdminModeOn, setAdminMode } from '@/lib/adminMode';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { MyProductsSection } from '@/components/user/MyProductsSection';
import { AvatarCropDialog } from '@/components/user/AvatarCropDialog';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { useNavigate } from 'react-router-dom';

const ProfileDataSection: React.FC<{ onCompletenessChange?: (complete: boolean) => void }> = ({ onCompletenessChange }) => {
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cpfLocked, setCpfLocked] = useState(false);
  const [cep, setCep] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrComplement, setAddrComplement] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [neighborhoodAutoFailed, setNeighborhoodAutoFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    const fetchExtra = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('phone, cpf, bio, birth_date, gender, cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state')
        .eq('user_id', user.id)
        .single();
      if (data?.phone) setPhone(data.phone);
      if (data?.bio) setBio(data.bio);
      if ((data as any)?.birth_date) setBirthDate((data as any).birth_date);
      if ((data as any)?.gender) setGender((data as any).gender);
      if (data?.cpf) {
        const d = data.cpf;
        setCpf(d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : d);
        setCpfLocked(true);
      }
      const d = data as any;
      if (d?.cep) setCep(d.cep.length === 8 ? `${d.cep.slice(0,5)}-${d.cep.slice(5)}` : d.cep);
      if (d?.address_street) setAddrStreet(d.address_street);
      if (d?.address_number) setAddrNumber(d.address_number);
      if (d?.address_complement) setAddrComplement(d.address_complement);
      if (d?.address_neighborhood) setAddrNeighborhood(d.address_neighborhood);
      if (d?.address_city) setAddrCity(d.address_city);
      if (d?.address_state) setAddrState(d.address_state);
    };
    fetchExtra();
  }, [user]);

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (json && !json.erro) {
        if (json.logradouro) setAddrStreet(json.logradouro);
        if (json.localidade) setAddrCity(json.localidade);
        if (json.uf) setAddrState(json.uf);
        // ViaCEP pode devolver bairro vazio — obrigamos preenchimento manual.
        if (json.bairro) {
          setAddrNeighborhood(json.bairro);
          setNeighborhoodAutoFailed(false);
        } else {
          setNeighborhoodAutoFailed(true);
        }
      }
    } catch {}
    finally { setCepLoading(false); }
  };


  useEffect(() => {
    if (!onCompletenessChange) return;
    const complete = Boolean(
      fullName.trim() &&
      phone.trim() &&
      bio.trim() &&
      birthDate &&
      gender &&
      cpf.replace(/\D/g, '').length === 11 &&
      avatarUrl
    );
    onCompletenessChange(complete);
  }, [fullName, phone, bio, birthDate, gender, cpf, avatarUrl, onCompletenessChange]);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    // reset input so the same file can be picked again later
    e.target.value = '';
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
      setCropSrc(null);
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
    // Bairro é obrigatório para a emissão da NF-e (NIBO/prefeitura).
    const hasAnyAddress = Boolean(
      cep.replace(/\D/g, '') || addrStreet.trim() || addrNumber.trim() || addrCity.trim() || addrState.trim()
    );
    if (hasAnyAddress && !addrNeighborhood.trim()) {
      setNeighborhoodAutoFailed(true);
      toast.error('Preencha o bairro', {
        description: 'O bairro é obrigatório para a emissão da nota fiscal.',
      });
      return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        birth_date: birthDate || null,
        gender: gender || null,
        cep: cep.replace(/\D/g, '') || null,
        address_street: addrStreet.trim() || null,
        address_number: addrNumber.trim() || null,
        address_complement: addrComplement.trim() || null,
        address_neighborhood: addrNeighborhood.trim() || null,
        address_city: addrCity.trim() || null,
        address_state: addrState.trim().toUpperCase().slice(0, 2) || null,
      };
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

  // Indicadores de campos incompletos (em tempo real conforme o usuário edita)
  const miss = {
    avatar: !avatarUrl,
    fullName: !fullName.trim(),
    bio: !bio.trim(),
    phone: !phone.trim(),
    birthDate: !birthDate,
    gender: !gender,
    cpf: cpf.replace(/\D/g, '').length !== 11,
    neighborhood: !addrNeighborhood.trim(),
    cep: cep.replace(/\D/g, '').length !== 8,
    street: !addrStreet.trim(),
    number: !addrNumber.trim(),
    city: !addrCity.trim(),
    state: !addrState.trim(),
  };

  const fiscalIncomplete =
    miss.cep || miss.street || miss.number || miss.neighborhood || miss.city || miss.state || miss.cpf;

  const neighborhoodMissing = neighborhoodAutoFailed && !addrNeighborhood.trim();


  const IncompleteTag = () => (
    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
      Incompleto
    </span>
  );

  const incompleteRing = 'ring-2 ring-destructive/40 focus-visible:ring-destructive';

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar className={cn("h-24 w-24", miss.avatar && "ring-2 ring-destructive/50")}>
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
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" />
        </div>
        {miss.avatar && (
          <div className="flex items-center gap-2">
            <IncompleteTag />
            <span className="text-xs text-muted-foreground">Adicione uma foto de perfil</span>
          </div>
        )}
        {uploadingAvatar && <p className="text-xs text-muted-foreground">Enviando foto...</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName" className="flex items-center gap-2">Nome completo {miss.fullName && <IncompleteTag />}</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className={cn(miss.fullName && incompleteRing)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio" className="flex items-center gap-2">Sobre você {miss.bio && <IncompleteTag />}</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Fale um pouco sobre você (aparece no Clube)" rows={3} className={cn(miss.bio && incompleteRing)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2">Telefone {miss.phone && <IncompleteTag />}</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className={cn(miss.phone && incompleteRing)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="birthDate" className="flex items-center gap-2">Data de nascimento {miss.birthDate && <IncompleteTag />}</Label>
          <Input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={cn("h-10 block appearance-none [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-0", miss.birthDate && incompleteRing)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender" className="flex items-center gap-2">Sexo {miss.gender && <IncompleteTag />}</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id="gender" className={cn(miss.gender && incompleteRing)}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
              <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cpf" className="flex items-center gap-2">CPF {miss.cpf && !cpfLocked && <IncompleteTag />}</Label>
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
          className={cn(cpfLocked && 'opacity-60', !cpfLocked && miss.cpf && incompleteRing)}
        />
        {cpfLocked && <p className="text-xs text-muted-foreground">O CPF não pode ser alterado após o cadastro.</p>}
      </div>

      <Separator />
      <div className="space-y-2">
        <Label className="text-base font-semibold">Endereço (para emissão de nota fiscal)</Label>
        <p className="text-xs text-muted-foreground">Usado apenas para emitir a NF-e das suas compras.</p>
        {fiscalIncomplete && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Dados fiscais incompletos. Complete para garantirmos a emissão da sua nota fiscal.</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-1">
          <Label htmlFor="cep" className="flex items-center gap-2">CEP {miss.cep && <IncompleteTag />}</Label>
          <Input
            id="cep"
            value={cep}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
              const formatted = digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits;
              setCep(formatted);
              if (digits.length === 8) lookupCep(digits);
            }}
            placeholder="00000-000"
            maxLength={9}
          />
          {cepLoading && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="addrStreet" className="flex items-center gap-2">Rua / Logradouro {miss.street && <IncompleteTag />}</Label>
          <Input id="addrStreet" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} placeholder="Rua das Flores" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-1">
          <Label htmlFor="addrNumber" className="flex items-center gap-2">Número {miss.number && <IncompleteTag />}</Label>
          <Input id="addrNumber" value={addrNumber} onChange={(e) => setAddrNumber(e.target.value)} placeholder="123" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="addrComplement">Complemento</Label>
          <Input id="addrComplement" value={addrComplement} onChange={(e) => setAddrComplement(e.target.value)} placeholder="Apto 42 (opcional)" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addrNeighborhood" className="flex items-center gap-2">Bairro {miss.neighborhood && <IncompleteTag />}</Label>
        <Input
          id="addrNeighborhood"
          value={addrNeighborhood}
          onChange={(e) => {
            setAddrNeighborhood(e.target.value);
            if (e.target.value.trim()) setNeighborhoodAutoFailed(false);
          }}
          aria-invalid={neighborhoodMissing}
          className={cn(neighborhoodMissing && 'border-destructive ring-2 ring-destructive/40 focus-visible:ring-destructive')}
        />
        {neighborhoodMissing && (
          <p className="text-xs text-destructive">Bairro não encontrado automaticamente, preencha manualmente</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="addrCity" className="flex items-center gap-2">Cidade {miss.city && <IncompleteTag />}</Label>
          <Input id="addrCity" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
        </div>
        <div className="space-y-2 col-span-1">
          <Label htmlFor="addrState" className="flex items-center gap-2">UF {miss.state && <IncompleteTag />}</Label>
          <Input id="addrState" value={addrState} onChange={(e) => setAddrState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" />
        </div>
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

      <AvatarCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc}
        onClose={() => setCropSrc(null)}
        onConfirm={handleCroppedUpload}
        saving={uploadingAvatar}
      />
    </div>
  );
};

const PasswordInput = ({ id, value, onChange, show, toggleShow, placeholder }: any) => (
  <div className="relative">
    <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} />
    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={toggleShow}>
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  </div>
);

const ChangePasswordSection: React.FC = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (!user?.email) { toast.error('E-mail não encontrado.'); return; }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Enviamos um link para o seu e-mail.');
    } catch (err: any) {
      toast.error('Erro ao enviar e-mail: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Para sua segurança, a troca de senha é feita por e-mail. Vamos enviar um link para{' '}
        <strong className="text-foreground">{user?.email}</strong> com instruções para criar uma nova senha — sem precisar lembrar da senha atual.
      </p>
      <Button onClick={handleSendReset} disabled={sending || sent} className="w-full">
        <Lock className="mr-2 h-4 w-4" />
        {sending ? 'Enviando...' : sent ? 'Link enviado!' : 'Enviar link por e-mail'}
      </Button>
      {sent && (
        <p className="text-xs text-muted-foreground text-center">
          Não recebeu? Verifique a caixa de spam ou tente novamente em alguns minutos.
        </p>
      )}
    </div>
  );
};

const PlanSection: React.FC = () => {
  const { data: planData, isLoading } = useUserPlan();
  const navigate = useNavigate();
  const isVip = !!planData?.isVip;
  const isLifetime = !!planData?.isLifetime;
  const isSocio = !!planData?.isSocio;
  const isAluno = !!planData?.isAluno;
  const expiresAt = planData?.expires_at ? new Date(planData.expires_at) : null;

  return (
    <div className="space-y-3 p-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : isVip ? (
        <>
          <div className="flex items-center gap-2">
            <Crown className={cn("h-5 w-5", isLifetime ? "text-amber-400" : "text-yellow-500")} />
            <p className="font-semibold">
              {isLifetime ? 'Sócio Vitalício dos Drinkeros' : 'Sócio Drinkeros'}
            </p>
          </div>
          {isLifetime ? (
            <p className="text-xs text-muted-foreground">Acesso vitalício — sem data de expiração.</p>
          ) : expiresAt ? (
            <p className="text-xs text-muted-foreground">
              Renova / expira em {expiresAt.toLocaleDateString('pt-BR')}
            </p>
          ) : null}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/app/clube/gerenciar')}
          >
            {isLifetime ? 'Gerenciar Acesso Vitalício' : 'Gerenciar plano Sócio'}
          </Button>
        </>
      ) : isAluno ? (
        <>
          <p className="font-semibold">Plano Aluno</p>
          <p className="text-sm text-muted-foreground">
            Você tem acesso aos cursos, e-books, combos ou pacotes que adquiriu. Vire Sócio para desbloquear receitas exclusivas, Batalha e bônus.
          </p>
          <Button
            className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-95 text-white border-0"
            onClick={() => navigate('/pv-clube')}
          >
            <Crown className="mr-2 h-4 w-4" />
            Virar Sócio Drinkeros
          </Button>
        </>
      ) : (
        <>
          <p className="font-semibold">Plano Grátis</p>
          <p className="text-sm text-muted-foreground">
            Faça upgrade para Sócio Drinkeros e desbloqueie receitas exclusivas, Batalha e muito mais.
          </p>
          <Button
            className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-95 text-white border-0"
            onClick={() => navigate('/pv-clube')}
          >
            <Crown className="mr-2 h-4 w-4" />
            Virar Sócio Drinkeros
          </Button>
        </>
      )}
    </div>
  );
};

const NotificationsSection: React.FC = () => {
  const { permission, isSubscribed, isLoading, isConfigured, isSupported, subscribe, unsubscribe } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  if (!isSupported) {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">
          Seu navegador não suporta notificações push. Tente abrir no Chrome, Edge ou instale o app na tela inicial.
        </p>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">As notificações push ainda não estão disponíveis.</p>
      </div>
    );
  }

  const blocked = permission === 'denied';

  const handleToggle = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        const ok = await subscribe();
        if (ok) toast.success('Notificações ativadas!');
        else if (Notification.permission === 'denied') {
          toast.error('Permissão bloqueada', {
            description: 'Libere as notificações nas configurações do navegador.',
          });
        } else toast.error('Não foi possível ativar as notificações.');
      } else {
        await unsubscribe();
        toast.success('Notificações desativadas.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Notificações push</p>
          <p className="text-xs text-muted-foreground">
            Receba avisos sobre novas aulas, receitas e novidades do Drinkeros.
          </p>
        </div>
        <Switch
          checked={isSubscribed}
          onCheckedChange={handleToggle}
          disabled={isLoading || busy || blocked}
        />
      </div>
      {blocked && (
        <p className="text-xs text-destructive">
          As notificações estão bloqueadas neste navegador. Libere a permissão nas configurações do site para ativar.
        </p>
      )}
    </div>
  );
};

const InterestsSection: React.FC = () => {
  const { data: interests } = useInterests();
  const updateInterests = useUpdateInterests();
  const [profissional, setProfissional] = useState(false);
  const [curticao, setCurticao] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfissional(!!interests?.includes('profissional'));
    setCurticao(!!interests?.includes('curticao'));
  }, [interests]);

  const handleSave = async () => {
    const next: Interest[] = [];
    if (profissional) next.push('profissional');
    if (curticao) next.push('curticao');
    setSaving(true);
    try {
      await updateInterests.mutateAsync(next);
      toast.success('Preferências atualizadas!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message ?? 'tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Marque seu interesse com drinks. Isso ajusta a ordem das receitas que aparecem no feed pra você. Fases sazonais (Natal, Carnaval, etc.) continuam aparecendo independente da escolha.
      </p>
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/30 transition-colors">
        <Checkbox checked={profissional} onCheckedChange={(v) => setProfissional(!!v)} className="mt-0.5" />
        <span className="flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-accent" /> Profissional
          </span>
          <span className="block text-xs text-muted-foreground mt-1">
            Sou ou quero ser bartender, trabalho com bar/eventos. Prioriza clássicos e amargos.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/30 transition-colors">
        <Checkbox checked={curticao} onCheckedChange={(v) => setCurticao(!!v)} className="mt-0.5" />
        <span className="flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <PartyPopper className="h-4 w-4 text-accent" /> Curtição
          </span>
          <span className="block text-xs text-muted-foreground mt-1">
            É hobby, faço drinks pra mim e pra galera. Feed misturado, como está hoje.
          </span>
        </span>
      </label>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Salvando...' : 'Salvar Preferências'}
      </Button>
    </div>
  );
};

const UserProfile: React.FC = () => {

  const { signOut, isSuperAdmin, isPartner } = useAuth();
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [adminMode, setAdminModeState] = useState<boolean>(() => isAdminModeOn());
  const { missingCount, missingFields, isComplete } = useProfileCompleteness();
  const { data: planData } = useUserPlan();
  const isVip = !!planData?.isVip;
  const isLifetime = !!planData?.isLifetime;
  const isSocio = !!planData?.isSocio;
  const isAluno = !!planData?.isAluno;

  const planLabel = isLifetime ? 'Vitalício' : isSocio ? 'Sócio' : isAluno ? 'Aluno' : 'Grátis';
  const planChipClass = isLifetime
    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/40'
    : isSocio
      ? 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
      : isAluno
        ? 'bg-sky-500/15 text-sky-500 border border-sky-500/30'
        : 'bg-lime-400 text-lime-950 shadow-sm';

  const toggle = (key: string) => setOpenSection(prev => prev === key ? null : key);

  const handleAdminToggle = () => {
    if (adminMode) {
      setAdminMode(false);
      setAdminModeState(false);
      navigate('/app/receitas');
    } else {
      setAdminMode(true);
      setAdminModeState(true);
      navigate('/admin');
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-2">
      {/* Dados Pessoais - collapsible */}
      <Collapsible open={openSection === 'dados'} onOpenChange={() => toggle('dados')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <User className="h-5 w-5 text-muted-foreground" />
            Dados Pessoais
            {!isComplete && (
              <span
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30"
                title={`Faltando: ${missingFields.join(', ')}`}
              >
                Incompleto · {missingCount}
              </span>
            )}
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'dados' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <ProfileDataSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Plano Atual - collapsible */}
      <Collapsible open={openSection === 'plano'} onOpenChange={() => toggle('plano')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <Crown className={cn("h-5 w-5", isVip ? "text-yellow-500" : "text-muted-foreground")} />
            Plano Atual
            <span className={cn(
              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
              planChipClass
            )}>
              {planLabel}
            </span>
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'plano' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <PlanSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Preferências de interesse */}
      <Collapsible open={openSection === 'interesses'} onOpenChange={() => toggle('interesses')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <Heart className="h-5 w-5 text-muted-foreground" />
            Preferências
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'interesses' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <InterestsSection />
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

      {/* Notificações - collapsible */}
      <Collapsible open={openSection === 'notif'} onOpenChange={() => toggle('notif')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 h-14 hover:bg-accent/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-medium">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notificações
          </span>
          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", openSection === 'notif' && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 border-border bg-card overflow-hidden">
          <NotificationsSection />
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

      {/* Painel do Parceiro */}
      {isPartner && !isSuperAdmin && (
        <button
          onClick={() => { setAdminMode(true); navigate('/admin/pedidos'); }}
          className="flex w-full items-center justify-between rounded-lg border border-accent/40 bg-accent/5 px-4 h-14 hover:bg-accent/10 transition-colors"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-accent">
            <Shield className="h-5 w-5" />
            Acessar painel do Parceiro
          </span>
          <ChevronRight className="h-5 w-5 text-accent" />
        </button>
      )}

      {/* Painel de Administração (mobile, super admin only) */}
      {isSuperAdmin && (
        <button
          onClick={handleAdminToggle}
          className="lg:hidden flex w-full items-center justify-between rounded-lg border border-accent/40 bg-accent/5 px-4 h-14 hover:bg-accent/10 transition-colors"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-accent">
            {adminMode ? <ArrowLeftRight className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            {adminMode ? 'Acessar como Cliente' : 'Painel de Administração'}
          </span>
          <ChevronRight className="h-5 w-5 text-accent" />
        </button>
      )}


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
