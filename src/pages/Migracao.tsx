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

type Step = 'email' | 'password' | 'done';

const Migracao: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-user-password', {
        body: { action: 'check', email: email.trim().toLowerCase() },
      });

      if (error) throw error;

      if (data?.exists) {
        setStep('password');
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

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter no mínimo 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'As senhas digitadas não são iguais.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-user-password', {
        body: { action: 'set_password', email: email.trim().toLowerCase(), password },
      });

      if (error) throw error;

      if (data?.success) {
        setStep('done');
        toast({
          title: 'Senha criada com sucesso!',
          description: 'Você já pode fazer login com sua nova senha.',
        });
      } else {
        toast({
          title: 'Erro',
          description: data?.error || 'Não foi possível criar a senha.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a senha. Tente novamente.',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 gap-4">
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
    </div>
  );
};

export default Migracao;
