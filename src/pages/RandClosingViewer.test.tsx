import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RandClosingViewer, { RandViewerScope } from './RandClosingViewer';
const mocks = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null, rpc: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isLoading: false, signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('./admin/AdminFinancialClosings', () => ({ default: ({ readOnly }: { readOnly: boolean }) => <p>{readOnly ? 'RAND somente leitura' : 'Admin'}</p> }));
function show(path = '/admin/users', page = false) {
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {page ? <RandClosingViewer /> : <RandViewerScope><Routes><Route path="/fechamentos/rand" element={<p>Consulta RAND</p>} /><Route path="*" element={<p>Outra área</p>} /></Routes></RandViewerScope>}
  </QueryClientProvider></MemoryRouter>);
}
beforeEach(() => { mocks.user = { id: 'viewer' }; mocks.rpc.mockReset().mockResolvedValue({ data: true, error: null }); });
afterEach(cleanup);
it('redirects financial viewers away from administration and members pages', async () => {
  show('/admin/users'); await screen.findByText('Consulta RAND'); expect(screen.queryByText('Outra área')).not.toBeInTheDocument();
  cleanup(); show('/app'); await screen.findByText('Consulta RAND');
});
it('keeps ordinary accounts on their existing routes', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null }); show('/app'); await screen.findByText('Outra área');
});
it('denies unassigned accounts access to the statement', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null }); show('/fechamentos/rand', true);
  await screen.findByText('Esta conta não tem acesso ao fechamento RAND.');
  expect(screen.queryByText('RAND somente leitura')).not.toBeInTheDocument();
});
it('shows only the read-only statement for assigned accounts', async () => {
  show('/fechamentos/rand', true); await screen.findByText('RAND somente leitura');
});
it('asks unauthenticated visitors to sign in without querying financial access', () => {
  mocks.user = null; show('/fechamentos/rand', true); expect(screen.getByLabelText('E-mail')).toBeInTheDocument(); expect(mocks.rpc).not.toHaveBeenCalled();
});
