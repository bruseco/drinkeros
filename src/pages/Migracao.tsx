import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import SeoHead from '@/components/SeoHead';

type Step = 'email' | 'done';

const Migracao: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke('migrate-user-password', {
        body: { action: 'check', email: normalized },
      });

      if (error) throw error;

      if (data?.exists) {
        const { data: sent, error: sendErr } = await supabase.functions.invoke(
          'send-reset-password-email',
          { body: { email: normalized } },
        );
        if (sendErr) throw sendErr;
        if (sent?.success === false) {
          toast({
            title: 'Não foi possível enviar agora',
            description: sent?.message || 'Tente novamente em alguns minutos.',
            variant: 'destructive',
          });
        } else {
          setStep('done');
        }
      } else {
        toast({
          title: 'E-mail não encontrado',
          description: 'Esse e-mail não está cadastrado na plataforma. Verifique ou entre em contato com o suporte.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o e-mail. Tente novamente.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 gap-4">
      <SeoHead
        title="Migração de Conta — Drinkeros"
        description="Migre sua conta antiga do Drinkeros para o novo sistema com inteligência artificial. Crie uma nova senha e acesse a plataforma renovada."
        path="/migracao"
      />
      <h1 className="sr-only">Migração de Conta Drinkeros</h1>
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-14 object-contain" />
          </Link>
          <CardTitle className="text-2xl">
            {step === 'done' ? 'Migração de Conta' : 'O Sistema mudou!'}
          </CardTitle>
          <CardDescription>
            {step === 'email' && 'Migre agora para a nova conta.'}
            {step === 'password' && 'Crie uma senha para acessar a plataforma.'}
            {step === 'done' && 'Tudo pronto! Sua conta foi migrada.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'email' && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm text-muted-foreground">
                <p>
                  Agora estamos com um novo sistema feito com{' '}
                  <span className="font-semibold text-foreground">inteligência artificial</span>,
                  assim temos mais controle e menos bugs. O aplicativo está{' '}
                  <span className="font-semibold text-foreground">mais rápido e mais inteligente</span>.
                </p>
                <p className="text-foreground font-medium">
                  Insira abaixo o e-mail utilizado no sistema antigo e crie uma nova senha de acesso.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="migration-email">E-mail</Label>
                <Input
                  id="migration-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-sm font-medium">{email}</p>
                <button
                  type="button"
                  className="text-xs text-primary underline mt-1"
                  onClick={() => setStep('email')}
                >
                  Trocar e-mail
                </button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando senha...
                  </>
                ) : (
                  'Criar senha'
                )}
              </Button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                Sua senha foi criada. Agora você pode acessar a plataforma.
              </p>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Ir para o Login
              </Button>
            </div>
          )}

          {step !== 'done' && (
            <div className="text-center pt-2">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                Voltar para o login
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Precisa de ajuda?</p>
            <p className="text-xs text-muted-foreground">Fale com o nosso suporte.</p>
          </div>
          <a
            href="https://wa.me/5548991601025?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20a%20migra%C3%A7%C3%A3o%20da%20minha%20conta."
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-white transition-transform hover:scale-105"
            style={{ backgroundColor: '#25D366' }}
            aria-label="Falar no WhatsApp"
          >
            <svg viewBox="0 0 32 32" className="h-5 w-5" fill="white">
              <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.129 6.744 3.047 9.381L1.054 31.2l6.012-1.932A15.907 15.907 0 0 0 16.004 32C24.826 32 32 24.822 32 16.004 32 7.176 24.826 0 16.004 0zm9.35 22.604c-.396 1.116-1.954 2.042-3.21 2.312-.862.182-1.986.328-5.774-1.242-4.848-2.008-7.966-6.93-8.208-7.252-.232-.322-1.95-2.6-1.95-4.96s1.234-3.518 1.672-3.998c.438-.48.958-.6 1.278-.6.318 0 .638.002.916.016.294.016.688-.112 1.078.822.396.952 1.354 3.312 1.472 3.552.12.24.2.52.04.838-.16.322-.24.52-.48.802-.24.28-.504.626-.72.84-.24.24-.49.502-.21.982.28.48 1.244 2.054 2.672 3.328 1.836 1.638 3.384 2.146 3.864 2.386.48.24.76.2 1.04-.12.28-.322 1.2-1.4 1.52-1.88.32-.48.64-.398 1.078-.24.44.16 2.794 1.318 3.274 1.558.48.24.798.36.918.558.118.2.118 1.14-.278 2.254z" />
            </svg>
            WhatsApp
          </a>
        </CardContent>
      </Card>
    </div>
  );
};

export default Migracao;
