import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackFbEvent, waitForPixelFlush } from '@/lib/metaPixel';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import drinksStrip from '@/assets/1000-drinks.jpg';
import AnimatedNumber from '@/components/AnimatedNumber';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import SeoHead from '@/components/SeoHead';

const Signup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const calcAge = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return -1;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  };
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !authLoading) navigate('/app');
  }, [user, authLoading, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !isValidPhoneNumber(phone)) {
      toast({
        title: 'WhatsApp inválido',
        description: 'Informe um número de WhatsApp válido com o código do país.',
        variant: 'destructive',
      });
      return;
    }

    const age = calcAge(birthDate);
    if (!birthDate || age < 0) {
      toast({ title: 'Data de nascimento inválida', description: 'Informe sua data de nascimento.', variant: 'destructive' });
      return;
    }
    if (age < 18) {
      toast({ title: 'Idade mínima 18 anos', description: 'O Drinkeros é exclusivo para maiores de 18 anos.', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha precisa ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'As senhas não conferem',
        description: 'Confirme a senha digitando-a novamente.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/app`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName, phone, birth_date: birthDate },
      },
    });

    if (error) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message.includes('already')
          ? 'Esse e-mail já está cadastrado. Tente fazer login.'
          : error.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase
          .from('profiles')
          .update({ phone, full_name: fullName, birth_date: birthDate })
          .eq('user_id', newUser.id);
      }
    } catch {
      /* non-blocking */
    }

    try {
      sessionStorage.setItem('drinkeros:just_signed_up', '1');
      sessionStorage.setItem('drinkeros:recipes_force_top', '1');
      sessionStorage.removeItem('user-recipes:scroll-to-key');
    } catch {}
    try {
      const { data: { user: createdUser } } = await supabase.auth.getUser();
      console.log('[Signup] disparando CompleteRegistration', { userId: createdUser?.id, method: 'email' });
      const { trackCompleteRegistration } = await import('@/lib/metaCapiBridge');
      await trackCompleteRegistration({
        userId: createdUser?.id,
        email,
        phone,
        fullName,
        method: 'email',
      });
      console.log('[Signup] CompleteRegistration enfileirado, aguardando flush...');
      // garante que o fbq enfileirou e a request CAPI iniciou antes do redirect
      await waitForPixelFlush(600);
      console.log('[Signup] redirect after signup → /app');
    } catch (err) {
      console.warn('[Signup] CompleteRegistration falhou', err);
    }
    navigate('/app', { replace: true, state: { justSignedUp: true } });

    setIsLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setIsOAuthLoading(provider);

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + '/login',
    });

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message,
        variant: 'destructive',
      });
      setIsOAuthLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 gap-4">
      <SeoHead
        title="Criar conta no Drinkeros — Cadastro grátis"
        description="Crie sua conta grátis no Drinkeros e tenha acesso a mais de 1.000 receitas, cursos de coquetelaria e benefícios do Clube dos Drinkeros."
        path="/signup"
      />
      <h1 className="sr-only">Criar conta no Drinkeros</h1>
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center p-0">
          <Link to="/" className="mx-auto mb-4 mt-6">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-14 object-contain" />
          </Link>
          <div className="w-full overflow-hidden">
            <div className="flex w-max animate-drinks-marquee">
              <img src={drinksStrip} alt="" aria-hidden className="h-28 w-auto max-w-none object-cover shrink-0" />
              <img src={drinksStrip} alt="" aria-hidden className="h-28 w-auto max-w-none object-cover shrink-0" />
            </div>
          </div>
          <div className="px-6 pt-0 pb-4 mt-[-10px] md:-mt-6">
            <CardTitle className="text-lg md:text-2xl">
              Mais de <AnimatedNumber target={1000} /> Drinks no seu Bolso.
            </CardTitle>
            <CardDescription className="text-success font-semibold mt-1 mb-4">Crie sua conta grátis!</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* OAuth Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth('google')}
              disabled={!!isOAuthLoading}
            >
              {isOAuthLoading === 'google' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Cadastrar com Google
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuth('apple')}
              disabled={!!isOAuthLoading}
            >
              {isOAuthLoading === 'apple' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Cadastrar com Apple
            </Button>
          </div>

          {/* Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {!showEmailForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowEmailForm(true)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Cadastrar com E-mail
            </Button>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="text-xs text-muted-foreground">Você precisa ter 18 anos ou mais.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">As senhas não conferem.</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar minha conta grátis'
                )}
              </Button>
            </form>
          )}

          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-foreground underline">
              Entrar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
