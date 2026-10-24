import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { UserNavbar } from './UserNavbar';
vi.mock('@/components/user/UserAvatarMenu', () => ({ UserAvatarMenu: () => null }));
afterEach(cleanup);
function Location() { const location = useLocation(); return <p data-testid="location">{location.pathname + location.search}</p>; }
it('returns a directly opened shopping list to the shopping overview', () => {
  render(<MemoryRouter initialEntries={['/app/favoritos?tab=shopping&list=saved-list']}><UserNavbar /><Location /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/app/favoritos?tab=shopping');
  expect(screen.getByTestId('location')).not.toHaveTextContent('list=');
});
it('does not add a detail back button on the shopping overview', () => {
  render(<MemoryRouter initialEntries={['/app/favoritos?tab=shopping']}><UserNavbar /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
});
