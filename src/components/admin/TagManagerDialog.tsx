import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Pencil, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TagManagerDialogProps {
  open: boolean;
  onClose: () => void;
  field: 'ingredients' | 'characteristics';
  tags: string[];
}

const TagManagerDialog: React.FC<TagManagerDialogProps> = ({ open, onClose, field, tags }) => {
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setLocalTags([...tags]);
      setNewTag('');
      setEditingTag(null);
    }
  }, [open, tags]);

  const title = field === 'ingredients' ? 'Ingredientes' : 'Características';

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (!trimmed || localTags.includes(trimmed)) return;
    setLocalTags(prev => [...prev, trimmed].sort());
    setNewTag('');
  };

  const handleDelete = async (tag: string) => {
    setSaving(true);
    try {
      // Find all posts that have this tag and remove it
      const { data: posts, error } = await supabase
        .from('exclusive_posts')
        .select('id, ' + field)
        .contains(field, [tag]);

      if (error) throw error;

      for (const post of posts || []) {
        const currentTags = (post as any)[field] as string[] || [];
        const updated = currentTags.filter(t => t !== tag);
        await supabase.from('exclusive_posts').update({ [field]: updated }).eq('id', post.id);
      }

      setLocalTags(prev => prev.filter(t => t !== tag));
      queryClient.invalidateQueries({ queryKey: ['existing-tags'] });
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast.success(`Tag "${tag}" removida de ${posts?.length || 0} receita(s)`);
    } catch (err: any) {
      toast.error('Erro ao remover tag: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (oldTag: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldTag) {
      setEditingTag(null);
      return;
    }

    setSaving(true);
    try {
      const { data: posts, error } = await supabase
        .from('exclusive_posts')
        .select('id, ' + field)
        .contains(field, [oldTag]);

      if (error) throw error;

      for (const post of posts || []) {
        const currentTags = (post as any)[field] as string[] || [];
        const updated = currentTags.map(t => t === oldTag ? trimmed : t);
        await supabase.from('exclusive_posts').update({ [field]: updated }).eq('id', post.id);
      }

      setLocalTags(prev => prev.map(t => t === oldTag ? trimmed : t).sort());
      setEditingTag(null);
      queryClient.invalidateQueries({ queryKey: ['existing-tags'] });
      queryClient.invalidateQueries({ queryKey: ['exclusive-posts'] });
      toast.success(`Tag renomeada: "${oldTag}" → "${trimmed}" em ${posts?.length || 0} receita(s)`);
    } catch (err: any) {
      toast.error('Erro ao renomear tag: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewToDb = async () => {
    const trimmed = newTag.trim();
    if (!trimmed || localTags.includes(trimmed)) return;

    // Just add locally - it will be available as an autocomplete option
    setLocalTags(prev => [...prev, trimmed].sort());
    setNewTag('');
    toast.success(`Tag "${trimmed}" adicionada. Ela aparecerá como sugestão ao editar receitas.`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerenciar {title}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder={`Adicionar ${field === 'ingredients' ? 'ingrediente' : 'característica'}...`}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNewToDb()}
          />
          <Button size="sm" onClick={handleAddNewToDb} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-2">{localTags.length} tag(s) cadastrada(s)</p>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {localTags.map((tag) => (
            <div key={tag} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
              {editingTag === tag ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(tag);
                      if (e.key === 'Escape') setEditingTag(null);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(tag)} disabled={saving}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTag(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="text-sm font-normal flex-1 justify-start">
                    {tag}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setEditingTag(tag); setEditValue(tag); }}
                    disabled={saving}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => handleDelete(tag)}
                    disabled={saving}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando alterações...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TagManagerDialog;
