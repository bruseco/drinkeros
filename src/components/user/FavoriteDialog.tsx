import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, FolderPlus, Plus, Loader2 } from 'lucide-react';
import { useCollections, useCreateCollection, useAddToCollection } from '@/hooks/useCollections';
import { useToggleFavorite } from '@/hooks/useUserData';
import { cn } from '@/lib/utils';

interface FavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  isFavorite: boolean;
}

const FavoriteDialog: React.FC<FavoriteDialogProps> = ({
  open,
  onOpenChange,
  recipeId,
  isFavorite,
}) => {
  const { data: collections = [] } = useCollections();
  const createCollection = useCreateCollection();
  const addToCollection = useAddToCollection();
  const toggleFavorite = useToggleFavorite();
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const handleFavoriteOnly = () => {
    if (!isFavorite) {
      toggleFavorite.mutate({ recipeId, isFavorite: false });
    }
    onOpenChange(false);
  };

  const handleAddToCollection = (collectionId: string) => {
    // Also add to favorites if not already
    if (!isFavorite) {
      toggleFavorite.mutate({ recipeId, isFavorite: false });
    }
    addToCollection.mutate({ collectionId, recipeId });
    onOpenChange(false);
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;
    const result = await createCollection.mutateAsync(newListName.trim());
    if (result) {
      if (!isFavorite) {
        toggleFavorite.mutate({ recipeId, isFavorite: false });
      }
      addToCollection.mutate({ collectionId: result.id, recipeId });
    }
    setNewListName('');
    setShowNewList(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Salvar receita</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {/* Save to favorites only */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 rounded-xl"
            onClick={handleFavoriteOnly}
          >
            <Heart className="h-5 w-5 text-red-500" />
            <span>Apenas nos favoritos</span>
          </Button>

          {/* Existing collections (exclude auto-managed "Aulas Favoritas") */}
          {collections.filter((col) => col.name !== 'Aulas Favoritas' && col.name !== 'Aulas' && col.name !== 'Cursos').map((col) => (
            <Button
              key={col.id}
              variant="outline"
              className="w-full justify-start gap-3 h-12 rounded-xl"
              onClick={() => handleAddToCollection(col.id)}
            >
              <FolderPlus className="h-5 w-5 text-primary" />
              <span>{col.name}</span>
            </Button>
          ))}

          {/* Create new list */}
          {showNewList ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nome da lista"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                autoFocus
                className="rounded-xl"
              />
              <Button
                size="icon"
                onClick={handleCreateAndAdd}
                disabled={!newListName.trim() || createCollection.isPending}
                className="rounded-xl shrink-0"
              >
                {createCollection.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 rounded-xl text-muted-foreground"
              onClick={() => setShowNewList(true)}
            >
              <Plus className="h-5 w-5" />
              <span>Criar nova lista</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FavoriteDialog;
