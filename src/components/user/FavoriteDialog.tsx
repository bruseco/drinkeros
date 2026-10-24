import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderPlus, Plus, Loader2 } from 'lucide-react';
import { useCollections, useSaveFavoriteToList } from '@/hooks/useCollections';

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
}) => {
  const { data: collections = [] } = useCollections();
  const save = useSaveFavoriteToList();
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const handleAddToCollection = async (collectionId: string) => {
    try { await save.mutateAsync({ recipeId, collectionId }); onOpenChange(false); }
    catch { /* The mutation displays its error toast; keep the dialog open. */ }
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;
    try {
      await save.mutateAsync({ recipeId, name: newListName.trim() });
      setNewListName(''); setShowNewList(false); onOpenChange(false);
    } catch { /* Keep the selected name available for retry. */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Escolha uma lista</DialogTitle>
          <DialogDescription>Escolha uma lista abaixo ou crie uma nova para salvar este favorito.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">

          {/* Existing collections (exclude auto-managed "Aulas Favoritas") */}
          {collections.filter((col) => col.name !== 'Aulas Favoritas' && col.name !== 'Aulas' && col.name !== 'Cursos').map((col) => (
            <Button
              key={col.id}
              variant="outline"
              className="w-full justify-start gap-3 h-12 rounded-xl"
              onClick={() => handleAddToCollection(col.id)}
              disabled={save.isPending}
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
                  maxLength={120}
                  disabled={save.isPending}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                autoFocus
                className="rounded-xl"
              />
              <Button
                size="icon"
                onClick={handleCreateAndAdd}
                  disabled={!newListName.trim() || save.isPending}
                  aria-label="Criar lista"
                className="rounded-xl shrink-0"
              >
                  {save.isPending ? (
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
