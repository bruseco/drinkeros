import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminFinancialClosings from './admin/AdminFinancialClosings';

const accessDb = supabase as unknown as SupabaseClient<{ public: {
  Tables: Record<string, never>; Views: Record<string, never>; Functions: {
    can_view_rand_closing: { Args: Record<string, never>; Returns: boolean };
  };
} }>;

async function checkAccess() {
  const { data, error } = await accessDb.rpc('can_view_rand_closing', {});
  if (error) throw error;
  return data === true;
}

// Dedicated financial accounts always enter their read-only area after login.
export function RandViewerScope({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { pathname } = useLocation();
  const accountPage = pathname === '/' || pathname === '/login'
    || pathname.startsWith('/admin') || pathname.startsWith('/app');
  const access = useQuery({ queryKey: ['rand-view-access', user?.id], enabled: !!user, queryFn: checkAccess });
  if (accountPage && (isLoading || (user && access.isLoading))) return <p className="p-6">Carregando…</p>;
  if (accountPage && user && access.data) return <Navigate to="/fechamentos/rand" replace />;
  return children;
}

export default function RandClosingViewer() {
  const { user, isLoading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const access = useQuery({
    queryKey: ['rand-view-access', user?.id], enabled: !!user,
    queryFn: checkAccess,
  });
  if (isLoading) return <p className="p-6">Carregando…</p>;
  if (!user) return <main className="mx-auto max-w-sm space-y-5 px-4 py-12">
    <h1 className="text-2xl font-bold">Fechamento RAND</h1>
    <p className="text-sm text-muted-foreground">Entre com sua conta do Drinkeros para visualizar o demonstrativo.</p>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setPending(true); setError('');
      try {
        const result = await signIn(email.trim(), password);
        if (result.error) setError('Não foi possível entrar. Confira seu e-mail e senha.');
        else setPassword('');
      } catch { setError('Não foi possível entrar. Tente novamente.'); }
      finally { setPending(false); }
    }}>
      <div className="space-y-2"><Label htmlFor="rand-email">E-mail</Label><Input id="rand-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="rand-password">Senha</Label><Input id="rand-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</Button>
    </form>
  </main>;
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
    <div className="flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Acesso exclusivo ao fechamento RAND · somente visualização</p><Button variant="outline" onClick={() => signOut()}>Sair</Button></div>
    {access.isLoading ? <p>Verificando acesso…</p> : access.isError ? <div role="alert"><p>Não foi possível verificar o acesso.</p><Button variant="outline" onClick={() => access.refetch()}>Tentar novamente</Button></div>
      : !access.data ? <p role="alert">Esta conta não tem acesso ao fechamento RAND.</p> : <AdminFinancialClosings readOnly />}
  </main>;
}
