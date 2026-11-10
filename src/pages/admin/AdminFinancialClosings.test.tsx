import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminFinancialClosings from './AdminFinancialClosings';

const mocks = vi.hoisted(() => ({
  superAdmin: true, rows: [] as unknown[], error: null as unknown,
  rpc: vi.fn(), invoke: vi.fn(), toastError: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isSuperAdmin: mocks.superAdmin, user: { id: 'viewer' } }) }));
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
function show(readOnly = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><AdminFinancialClosings readOnly={readOnly} /></QueryClientProvider></MemoryRouter>);
}
beforeEach(() => {
  mocks.superAdmin = true; mocks.rows = []; mocks.error = null;
  mocks.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  mocks.invoke.mockReset().mockResolvedValue({ data: { closing: {} }, error: null });
  mocks.toastError.mockReset();
});
afterEach(cleanup);

describe('financial closing admin flow', () => {
  it('lets a viewer filter months without refresh or settlement controls', async () => {
    mocks.superAdmin = false;
    mocks.rpc.mockResolvedValue({ data: [fixture('2020-09'), fixture('2020-08', 'paid')], error: null });
    show(true);
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    await screen.findByText(/A atualização e o registro dos repasses são feitos pela administração/);
    expect(mocks.rpc).toHaveBeenCalledWith('view_rand_closings', {});
    expect(screen.queryByRole('button', { name: 'Atualizar demonstrativo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como acertado' })).not.toBeInTheDocument();
    expect(screen.queryByText('← Todos os parceiros')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-08' } });
    await screen.findByText(/Este demonstrativo está preservado/);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'view_rand_closings')).toBe(true);
  });
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
  it('adds a named monthly expense in exact cents without refreshing the gateway or marking a closing paid', async () => {
    mocks.rows = [fixture('2020-09')];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    await screen.findByRole('button', { name: 'Adicionar custo' });
    fireEvent.change(screen.getByLabelText('Descrição do custo'), { target: { value: 'ManyChat' } });
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '10,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar custo' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('save_rand_closing_cost', {
      p_month: '2020-09-01', p_description: 'ManyChat', p_amount_cents: 1050,
    }));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'save_rand_closing_cost')).toBe(true);
  });
  it('rejects an invalid expense before sending it to the server', async () => {
    mocks.rows = [fixture('2020-09')];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    await screen.findByRole('button', { name: 'Adicionar custo' });
    fireEvent.change(screen.getByLabelText('Descrição do custo'), { target: { value: 'ManyChat' } });
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar custo' }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
  });
  it('preserves a paid statement and disables refresh', async () => {
    mocks.rows = [fixture('2020-09', 'paid')];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    await screen.findByText(/Este demonstrativo está preservado/);
    expect(screen.getByRole('button', { name: 'Atualizar demonstrativo' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Marcar como acertado' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Fechamento acertado' })).toHaveTextContent('Acertado');
    expect(screen.queryByRole('button', { name: 'Adicionar custo' })).not.toBeInTheDocument();
  });
  it('navigates across year boundaries without refreshing or marking any closing', async () => {
    mocks.rows = [fixture('2020-12', 'paid'), { ...fixture('2021-01'), status: 'carried', carried_to: '2021-02-01' }];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-12' } });
    await screen.findByRole('status', { name: 'Fechamento acertado' });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByLabelText('Mês do pagamento do cliente')).toHaveValue('2021-01');
    expect(screen.queryByRole('status', { name: 'Fechamento acertado' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByLabelText('Mês do pagamento do cliente')).toHaveValue('2020-12');
    expect(screen.getByRole('status', { name: 'Fechamento acertado' })).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('lets the administrator attest an existing settlement without refreshing the saved amount', async () => {
    const saved = { ...fixture('2020-09'), synced_at: '2020-10-07T11:58:17Z' };
    mocks.rows = [saved];
    show();
    fireEvent.change(screen.getByLabelText('Mês do pagamento do cliente'), { target: { value: '2020-09' } });
    const button = await screen.findByRole('button', { name: 'Marcar como acertado' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Registrar acerto já realizado de setembro de 2020');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('sem atualizar ou recalcular os valores salvos');
    fireEvent.click(screen.getByRole('button', { name: 'Os repasses foram acertados' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('record_rand_closing_settled', {
      p_month: saved.month, p_draft_id: saved.draft_id, p_rand_cents: 5520,
    }));
    expect(mocks.invoke).not.toHaveBeenCalled();
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
