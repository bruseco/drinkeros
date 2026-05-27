import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import drinksStrip from '@/assets/1000-drinks.jpg';
import SeoHead from '@/components/SeoHead';

const CompleteProfile: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone, full_name, birth_date')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.phone && data?.birth_date) {
        navigate('/app', { replace: true });
        return;
      }
      setFullName(data?.full_name || (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || '');
      if (data?.birth_date) setBirthDate(data.birth_date);
      setChecking(false);
    })();
  }, [user, authLoading, navigate]);

  const calcAge = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return -1;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !isValidPhoneNumber(phone)) {
      toast({
        title: 'WhatsApp inválido',
        description: 'Informe um número de WhatsApp válido com o código do país.',
        variant: 'destructive',
      });
      return;
    }
    if (!fullName.trim()) {
      toast({ title: 'Nome obrigatório', description: 'Informe seu nome completo.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const trimmedName = fullName.trim();
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: user!.id, email: user!.email ?? '', phone, full_name: trimmedName },
        { onConflict: 'user_id' }
      );
    if (!error) {
      // Mantém o metadata do auth.users sincronizado com nome e telefone
      await supabase.auth.updateUser({ data: { full_name: trimmedName, phone } }).catch(() => {});
    }
    setIsSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tudo certo! 🍹', description: 'Bem-vindo ao Drinkeros!' });
    navigate('/app', { replace: true });
  };

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 gap-4">
      <SeoHead title="Complete seu cadastro — Drinkeros" description="Finalize seu cadastro no Drinkeros informando seu WhatsApp." path="/complete-profile" />
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center p-0">
          <div className="mx-auto mb-4 mt-6">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-14 object-contain" />
          </div>
          <div className="w-full overflow-hidden">
            <div className="flex w-max animate-drinks-marquee">
              <img src={drinksStrip} alt="" aria-hidden className="h-28 w-auto max-w-none object-cover shrink-0" />
              <img src={drinksStrip} alt="" aria-hidden className="h-28 w-auto max-w-none object-cover shrink-0" />
            </div>
          </div>
          <div className="px-6 pt-0 pb-4 mt-[-10px] md:-mt-6">
            <CardTitle className="text-lg md:text-2xl">Falta só um passo!</CardTitle>
            <CardDescription className="mt-1 mb-4">Informe seu WhatsApp para liberar seu acesso.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <PhoneInput
                id="phone"
                international
                defaultCountry="BR"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={setPhone}
                className="phone-input-custom"
              />
              {phone && !isValidPhoneNumber(phone) && (
                <p className="text-xs text-destructive">Número inválido para o país selecionado.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Continuar para o app'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfile;
