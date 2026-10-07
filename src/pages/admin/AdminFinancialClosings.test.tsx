import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminFinancialClosings from './AdminFinancialClosings';

const mocks = vi.hoisted(() => ({
  superAdmin: true, rows: [] as unknown[], error: null as unknown,
  rpc: vi.fn(), invoke: vi.fn(), toastError: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isSuperAdmin: mocks.superAdmin }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ order: async () => ({ data: mocks.rows, error: mocks.error }) }) }),
  rpc: mocks.rpc, functions: { invoke: mocks.invoke },
} }));
const fixture = (month: string, status = 'draft') => ({
  month: `${month}-01`, status, draft_id: '00000000-0000-0000-0000-000000000123',
  synced_at: new Date().toISOString(), paid_at: status === 'paid' ? new Date().toISOString() : null,
  report: { month, sales_count: 1, refund_count: 0, gross_cents: 10000, refund_cents: 0,
    tax_base_cents: 10000, pix_fee_cents: 100, card_fee_cents: 0, tax_cents: 700,
    adjustments_cents: 0, net_cents: 9200, rand_cents: 5520, drinkeros_cents: 3680, lines: [] },
});
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><AdminFinancialClosings /></QueryClientProvider></MemoryRouter>);
}
beforeEach(() => {
  mocks.superAdmin = true; mocks.rows = []; mocks.error = null;
  mocks.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  mocks.invoke.mockReset().mockResolvedValue({ data: { closing: {} }, error: null });
  mocks.toastError.mockReset();
});
afterEach(cleanup);

describe('financial closing admin flow', () => {
  it('requires super-admin access before reading financial statements', () => {
    mocks.superAdmin = false;
    show();
    expect(screen.queryByText('Fechamentos')).not.toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('makes the actual-gateway refresh explicit, without creating a transfer', async () => {
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar demonstrativo' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('rand-financial-closing', { body: { month: '2020-09' } }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('confirms the displayed draft before recording payment', async () => {
    mocks.rows = [fixture('2020-09')];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como acertado' }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('RAND R$ 55,20');
    fireEvent.click(screen.getByRole('button', { name: 'Os repasses foram acertados' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('mark_rand_closing_paid', {
      p_month: '2020-09-01', p_draft_id: '00000000-0000-0000-0000-000000000123',
    }));
  });
  it('preserves a paid statement and disables refresh', async () => {
    mocks.rows = [fixture('2020-09', 'paid')];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    await screen.findByText(/Este demonstrativo está preservado/);
    expect(screen.getByRole('button', { name: 'Atualizar demonstrativo' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Marcar como acertado' })).not.toBeInTheDocument();
  });
  it('blocks payment after a failed refresh instead of showing incomplete fees as zero', async () => {
    mocks.rows = [fixture('2020-09')];
    mocks.invoke.mockResolvedValue({ data: { error: 'Taxas reais indisponíveis.' }, error: null });
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    await screen.findByRole('button', { name: 'Marcar como acertado' });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar demonstrativo' }));
    await screen.findByText(/Taxas reais indisponíveis/);
    expect(screen.getByRole('button', { name: 'Marcar como acertado' })).toBeDisabled();
  });
});
