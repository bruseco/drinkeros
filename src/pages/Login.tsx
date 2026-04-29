import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstallBanner } from '@/components/user/InstallBanner';
import { WhatsAppFloatingButton } from '@/components/user/WhatsAppFloatingButton';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import drinksStrip from '@/assets/1000-drinks.jpg';

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [lastMethod, setLastMethod] = useState<string | null>(null);
  const { signIn, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    try {
      setLastMethod(localStorage.getItem('drinkeros:last_auth_method'));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/app');
    }
  }, [user, authLoading, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let { error } = await signIn(email, password);

    if (error && /conectar|network|failed to fetch/i.test(error.message)) {
      await new Promise((r) => setTimeout(r, 1500));
      ({ error } = await signIn(email, password));
    }

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/app');
    }

    setIsLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMagicLink(true);

    const { data, error } = await supabase.functions.invoke('send-magic-link', {
      body: { email: magicLinkEmail },
    });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o link. Tente novamente.',
        variant: 'destructive',
      });
    } else {
      setMagicLinkSent(true);
      toast({
        title: 'Link enviado!',
        description: 'Verifique seu e-mail para acessar a plataforma.',
      });
    }

    setIsMagicLink(false);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setIsOAuthLoading(provider);

    // Unregister service worker to prevent it from intercepting /~oauth callback
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-reset-password-email', {
        body: { email: resetEmail },
      });

      if (error) throw error;

      toast({
        title: 'Email enviado',
        description: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.',
      });
      setResetDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o email. Tente novamente.',
        variant: 'destructive',
      });
    }

    setIsResetting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 gap-4">
      {/* Install Banner */}
      <div className="w-full max-w-md">
        <InstallBanner />
      </div>
      
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
          <div className="px-6 pt-0 pb-4 -mt-6">
            <CardTitle className="text-2xl">Mais de 1000 Drinks no seu Bolso.</CardTitle>
            <CardDescription className="text-success font-semibold mt-1 mb-4">Baixe grátis!</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* OAuth Buttons */}
          <div className="space-y-2">
            <div className="relative">
              {lastMethod === 'google' && (
                <span className="absolute -top-2 right-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                  Último acesso
                </span>
              )}
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
                Entrar com Google
              </Button>
            </div>
            <div className="relative">
              {lastMethod === 'apple' && (
                <span className="absolute -top-2 right-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                  Último acesso
                </span>
              )}
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
                Entrar com Apple
              </Button>
            </div>
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

          {/* Password Login */}
          <form onSubmit={handleLogin} className="space-y-4">
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
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              {lastMethod === 'email' && (
                <span className="absolute -top-2 right-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                  Último acesso
                </span>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </div>
          </form>

          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            Não tem conta?{' '}
            <Link to="/signup" className="font-semibold text-foreground underline">
              Crie agora mesmo!
            </Link>
          </div>

          <div className="text-center">
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="link" className="text-sm text-muted-foreground">
                  Esqueceu sua senha?
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Recuperar senha</DialogTitle>
                  <DialogDescription>
                    Digite seu e-mail e enviaremos um link para redefinir sua senha.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">E-mail</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isResetting}>
                    {isResetting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link'
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
      <WhatsAppFloatingButton />
    </div>
  );
};

export default Login;
