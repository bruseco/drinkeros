import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CreateAccount from './CreateAccount';
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), invoke: vi.fn(), getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithPassword: mocks.signIn, getSession: mocks.getSession }, functions: { invoke: mocks.invoke } } }));
vi.mock('@/components/SeoHead', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
beforeEach(() => {
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mocks.signIn.mockReset().mockResolvedValue({ error: null });
  mocks.invoke.mockReset().mockResolvedValue({ data: { success: true }, error: null });
});
afterEach(cleanup);
function show(section: string) {
  render(<MemoryRouter initialEntries={[`/criar-conta?pid=123&email=buyer%40example.com&redirect=${encodeURIComponent(section)}`]}><Routes>
    <Route path="/criar-conta" element={<CreateAccount />} />
    <Route path="/app/ebooks" element={<p>Biblioteca de e-books</p>} />
    <Route path="/app/cursos" element={<p>Biblioteca de cursos</p>} />
    <Route path="/login" element={<p>Login necessário</p>} />
  </Routes></MemoryRouter>);
}
it.each([['/app/ebooks', 'Biblioteca de e-books'], ['/app/cursos', 'Biblioteca de cursos']])('activates and signs in before entering %s', async (section, label) => {
  show(section);
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } });
  fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith({ email: 'buyer@example.com', password: 'test-password' }));
  expect(await screen.findByText(label, {}, { timeout: 2000 })).toBeInTheDocument();
  expect(screen.queryByText('Login necessário')).not.toBeInTheDocument();
});
it('does not claim a logged-in session when sign-in fails', async () => {
  mocks.signIn.mockResolvedValue({ error: new Error('failed') }); show('/app/ebooks');
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-password' } });
  fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));
  await screen.findByText('Login necessário'); expect(screen.queryByText('Biblioteca de e-books')).not.toBeInTheDocument();
});
