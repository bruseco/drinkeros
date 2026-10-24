import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FavoriteDialog from './FavoriteDialog';
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/hooks/useCollections', () => ({ useCollections: () => ({ data: [{ id: 'a', name: 'Festa' }, { id: 'legacy', name: 'Sem lista' }] }), useSaveFavoriteToList: () => ({ mutateAsync: mocks.save, isPending: false }) }));
beforeEach(() => { mocks.save.mockReset().mockResolvedValue('a'); }); afterEach(cleanup);
it('requires selecting a list and permits explicit selection of the migrated legacy folder', async () => {
  const close=vi.fn(); render(<FavoriteDialog open onOpenChange={close} recipeId="drink" isFavorite={false} />);
  expect(screen.queryByText('Apenas nos favoritos')).not.toBeInTheDocument(); expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{ name:'Sem lista' })); await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith({ recipeId:'drink', collectionId:'legacy' }));
  expect(close).toHaveBeenCalledWith(false);
});
it('creates the list and favorite in a single operation', async () => {
  render(<FavoriteDialog open onOpenChange={vi.fn()} recipeId="drink" isFavorite={false} />);
  fireEvent.click(screen.getByRole('button',{ name:'Criar nova lista' }));
  fireEvent.change(screen.getByPlaceholderText('Nome da lista'),{ target:{ value:'Churrasco' } });
  fireEvent.click(screen.getByRole('button',{ name:'Criar lista' }));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith({ recipeId:'drink', name:'Churrasco' }));
});
it('keeps the choice open after a save failure', async () => {
  mocks.save.mockRejectedValue(new Error('failed')); const close=vi.fn();
  render(<FavoriteDialog open onOpenChange={close} recipeId="drink" isFavorite={false} />);
  fireEvent.click(screen.getByRole('button',{ name:'Festa' }));
  await waitFor(()=>expect(mocks.save).toHaveBeenCalled()); expect(close).not.toHaveBeenCalled();
});
