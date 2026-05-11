import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// --- Mocks de auth + supabase para simular usuário vitalício ---
const mockUser = { id: 'lifetime-user-1' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const buildSelect = (row: any) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
    }),
  });
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'user_plans') {
          // Mesmo cenário do bug: user_plans tem expires_at, mas é vitalício
          return buildSelect({ plan: 'vip', expires_at: '2027-04-14T20:04:50Z' });
        }
        if (table === 'user_lifetime_access') {
          return buildSelect({ user_id: mockUser.id });
        }
        return buildSelect(null);
      },
      rpc: async () => ({ data: 'vip', error: null }),
    },
  };
});

import { PlanBadge } from '@/components/user/PlanBadge';
import { useUserPlan } from '@/hooks/useUserPlan';

// Réplica enxuta do PlanSection do UserProfile, usando o mesmo hook + componente
const ProfilePlanArea: React.FC = () => {
  const { data } = useUserPlan();
  if (!data) return <p>Carregando...</p>;
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  return (
    <div>
      <PlanBadge linkOnFree={false} />
      <p>{data.isLifetime ? 'Sócio Vitalício dos Drinkeros' : 'Sócio do Clube dos Drinkeros'}</p>
      {data.isLifetime ? (
        <p>Acesso vitalício — sem data de expiração.</p>
      ) : expiresAt ? (
        <p>Renova / expira em {expiresAt.toLocaleDateString('pt-BR')}</p>
      ) : null}
    </div>
  );
};

const renderProfile = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProfilePlanArea />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('E2E — Perfil de usuário vitalício', () => {
  it('mostra o badge VITALÍCIO e não exibe data de expiração', async () => {
    renderProfile();

    // Badge "Vitalício" (também aparece no título "Sócio Vitalício...")
    await waitFor(() => {
      expect(screen.getAllByText(/Vitalício/i).length).toBeGreaterThanOrEqual(2);
    });

    // NÃO deve aparecer "Clube" como label do badge
    expect(screen.queryByText(/^Clube$/)).not.toBeInTheDocument();

    // NÃO deve haver texto de expiração
    expect(screen.queryByText(/Renova \/ expira em/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/14\/04\/2027/)).not.toBeInTheDocument();

    // DEVE constar a mensagem de acesso vitalício
    expect(screen.getByText(/Acesso vitalício — sem data de expiração\./i)).toBeInTheDocument();

    // Título correto
    expect(screen.getByText(/Sócio Vitalício dos Drinkeros/i)).toBeInTheDocument();
  });
});
