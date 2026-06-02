import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';

/**
 * A cada N acessos do usuário logado ao app, reativa a oferta intro do Clube
 * (R$69) chamando o RPC `retrigger_clube_intro_offer`. Conta apenas 1 acesso
 * por sessão (sessionStorage) para evitar disparos múltiplos no mesmo carregamento.
 */
const RETRIGGER_EVERY = 5;
const COUNT_KEY = 'clube:app-access-count';
const SESSION_FLAG = 'clube:app-access-counted';

export const ClubeRetriggerWatcher: React.FC = () => {
  const { user } = useAuth();
  const { data: plan } = useUserPlan();
  const queryClient = useQueryClient();
  const isMember = !!(plan?.isVip || plan?.isLifetime);

  useEffect(() => {
    if (!user?.id || isMember) return;
    try {
      if (sessionStorage.getItem(SESSION_FLAG) === '1') return;
      sessionStorage.setItem(SESSION_FLAG, '1');

      const current = Number(localStorage.getItem(COUNT_KEY) || '0') || 0;
      const next = current + 1;

      if (next >= RETRIGGER_EVERY) {
        localStorage.setItem(COUNT_KEY, '0');
        supabase.rpc('retrigger_clube_intro_offer' as any).then(({ error }) => {
          if (error) {
            console.warn('[clube-retrigger] erro:', error.message);
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['clube-intro', user.id] });
        });
      } else {
        localStorage.setItem(COUNT_KEY, String(next));
      }
    } catch {
      /* ignore */
    }
  }, [user?.id, isMember, queryClient]);

  return null;
};

export default ClubeRetriggerWatcher;
