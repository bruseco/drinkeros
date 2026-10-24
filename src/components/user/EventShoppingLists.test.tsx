import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EventShoppingLists } from './EventShoppingLists';
import { makeShoppingPlan } from '@/lib/shoppingPlan';
const mocks = vi.hoisted(() => ({ lists: [] as unknown[], checks: [] as unknown[], mutate: vi.fn(), download: vi.fn(), remove: vi.fn() }));
vi.mock('@/hooks/useEventShoppingLists', () => ({
  useEventShoppingLists: () => ({ data: mocks.lists }),
  useEventShoppingChecks: () => ({ data: mocks.checks }),
  useSetEventShoppingCheck: () => ({ mutate: mocks.mutate }),
  useDeleteEventShoppingList: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
vi.mock('@/lib/shoppingPdf', () => ({ downloadShoppingPdf: mocks.download }));
beforeEach(() => { mocks.lists = [{ id: 'l', name: 'Churrasco', created_at: '2026-10-24T12:00:00Z', plan: makeShoppingPlan('Churrasco', [{ id: 'r', name: 'Rum', ingredients: ['50 ml de Rum'], yield: 1 }], 5, 3) }]; mocks.checks = []; mocks.mutate.mockReset(); mocks.download.mockReset(); });
beforeEach(() => { mocks.remove.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it('opens an event from the list of saved shopping lists', () => {
  const onSelect = vi.fn(); render(<EventShoppingLists selectedId={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: /Lista de compras Churrasco/ })); expect(onSelect).toHaveBeenCalledWith('l'); expect(mocks.download).not.toHaveBeenCalled();
});
it('moves checked items below pending items and can restore them', () => {
  mocks.checks = [{ list_id: 'l', item_index: 0, is_checked: true }];
  render(<EventShoppingLists selectedId="l" onSelect={vi.fn()} />);
  expect(screen.getAllByTestId('shopping-item')[0]).toHaveTextContent('Rum');
  expect(screen.getAllByTestId('shopping-item')[1]).toHaveTextContent('Gelo');
  fireEvent.click(screen.getByRole('checkbox', { name: /Gelo/ })); expect(mocks.mutate).toHaveBeenCalledWith({ index: 0, checked: false });
});
it('shows completion when every item has been bought', () => {
  mocks.checks = [0, 1].map(item_index => ({ list_id: 'l', item_index, is_checked: true }));
  render(<EventShoppingLists selectedId="l" onSelect={vi.fn()} />);
  expect(screen.getByText('Lista completa!')).toBeInTheDocument(); expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
});
it('only downloads a PDF when explicitly requested', async () => {
  render(<EventShoppingLists selectedId="l" onSelect={vi.fn()} />); expect(mocks.download).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' })); await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
});
it('requires confirmation without opening the list when its card trash is clicked', async () => {
  const onSelect = vi.fn(); render(<EventShoppingLists selectedId={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista Churrasco' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Seus favoritos serão mantidos.');
  expect(onSelect).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista Churrasco' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('l'));
});
it('returns to the overview only after confirmed deletion from the open list', async () => {
  const onSelect = vi.fn(); render(<EventShoppingLists selectedId="l" onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista Churrasco' }));
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
});
it('keeps the confirmation open on failure and preserves the current list', async () => {
  mocks.remove.mockRejectedValue(new Error('offline')); const onSelect = vi.fn();
  render(<EventShoppingLists selectedId="l" onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista Churrasco' }));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lista' }));
  await screen.findByRole('alert'); expect(screen.getByRole('alertdialog')).toBeInTheDocument(); expect(onSelect).not.toHaveBeenCalled();
});
