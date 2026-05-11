import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserPlan } from './useUserPlan';

// --- Mocks ---
const mockUser = { id: 'user-123' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

type LifetimeRow = { user_id: string } | null;
type PlanRow = { plan: string; expires_at: string | null } | null;

let lifetimeRow: LifetimeRow = null;
let planRow: PlanRow = null;
let effectivePlan: 'free' | 'vip' = 'free';

vi.mock('@/integrations/supabase/client', () => {
  const buildSelect = (row: any) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row, error: null }),
      }),
    }),
  });
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'user_plans') return buildSelect(planRow);
        if (table === 'user_lifetime_access') return buildSelect(lifetimeRow);
        return buildSelect(null);
      },
      rpc: async (_fn: string) => ({ data: effectivePlan, error: null }),
    },
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('useUserPlan — lifetime access', () => {
  beforeEach(() => {
    lifetimeRow = null;
    planRow = null;
    effectivePlan = 'free';
  });

  it('lifetime user returns expires_at = null even when user_plans has a date', async () => {
    lifetimeRow = { user_id: 'user-123' };
    planRow = { plan: 'vip', expires_at: '2027-04-14T00:00:00Z' };
    effectivePlan = 'vip';

    const { result } = renderHook(() => useUserPlan(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.isLifetime).toBe(true);
    expect(result.current.data?.isVip).toBe(true);
    expect(result.current.data?.expires_at).toBeNull();
  });

  it('lifetime user with no plan row still returns expires_at = null and isVip', async () => {
    lifetimeRow = { user_id: 'user-123' };
    planRow = null;
    effectivePlan = 'vip';

    const { result } = renderHook(() => useUserPlan(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.isLifetime).toBe(true);
    expect(result.current.data?.expires_at).toBeNull();
  });

  it('non-lifetime VIP user keeps the user_plans expires_at date', async () => {
    lifetimeRow = null;
    planRow = { plan: 'vip', expires_at: '2027-04-14T00:00:00Z' };
    effectivePlan = 'vip';

    const { result } = renderHook(() => useUserPlan(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.isLifetime).toBe(false);
    expect(result.current.data?.isVip).toBe(true);
    expect(result.current.data?.expires_at).toBe('2027-04-14T00:00:00Z');
  });

  it('free user returns expires_at = null and isLifetime = false', async () => {
    lifetimeRow = null;
    planRow = null;
    effectivePlan = 'free';

    const { result } = renderHook(() => useUserPlan(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.isVip).toBe(false);
    expect(result.current.data?.isLifetime).toBe(false);
    expect(result.current.data?.expires_at).toBeNull();
  });
});
