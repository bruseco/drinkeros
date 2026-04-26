import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import AutocompleteTagInput from '@/components/admin/AutocompleteTagInput';
import { useExistingTags } from '@/hooks/useExistingTags';
import { findCanonicalTag } from '@/lib/normalizeTag';

const UserBatalhaNew: React.FC = () => {
  const { user } = useAuth();
  const { data: planData, isLoading: planLoading } = useUserPlan();
  const nav = useNavigate();
  const { data: existingTags } = useExistingTags();
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [characteristics, setCharacteristics] = useState<string[]>([]);
  const [characteristicInput, setCharacteristicInput] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bloqueio: somente sócios do Clube podem postar
  useEffect(() => {
    if (!planLoading && planData && !planData.isVip) {
      toast.info('Para postar na Batalha você precisa ser sócio do Clube dos Drinkeros.');
      nav('/clube', { replace: true });
    }
  }, [planLoading, planData, nav]);

  const ingredientSuggestions = existingTags?.ingredients ?? [];
  const characteristicSuggestions = existingTags?.characteristics ?? [];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const addTag = (
    raw: string,
    pool: string[],
    current: string[],
    setter: (v: string[]) => void,
  ) => {
    const canonical = findCanonicalTag(raw, pool);
    if (!canonical) return;
    if (current.some((t) => t.toLowerCase() === canonical.toLowerCase())) return;
    // Avisa se foi normalizada/corrigida
    if (canonical.toLowerCase() !== raw.trim().toLowerCase()) {
      toast.info(`Tag ajustada para "${canonical}"`);
    }
    setter([...current, canonical]);
  };

  const removeTag = (tag: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim() || ingredients.length === 0 || !instructions.trim()) {
      toast.error('Preencha nome, ingredientes e passo a passo.');
      return;
    }
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('club-recipes').upload(path, imageFile);
        if (upErr) throw upErr;
        image_url = supabase.storage.from('club-recipes').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('club_recipes').insert({
        user_id: user.id,
        name: name.trim(),
        image_url,
        ingredients: ingredients.join(', '),
        instructions: instructions.trim(),
        characteristics,
        description: description.trim() || null,
      });
      if (error) throw error;
      toast.success('Receita publicada! +5 pontos 🎉');
      nav('/app/batalha');
    } catch (err: any) {
      toast.error('Erro ao publicar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-6 px-4 pb-24 md:pb-6 space-y-4">
      <h1 className="text-2xl font-bold">Postar Receita no Clube</h1>

      <div className="space-y-2">
        <Label>Foto da receita</Label>
        <label className="flex items-center justify-center w-full aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 overflow-hidden">
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-muted-foreground"><Upload className="h-8 w-8 mx-auto mb-2" />Toque para enviar</div>
          )}
          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        </label>
      </div>

      <div className="space-y-2">
        <Label>Nome da receita *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Aurora Tropical" />
      </div>

      <div className="space-y-2">
        <Label>Ingredientes *</Label>
        <p className="text-xs text-muted-foreground">Adicione apenas o nome do ingrediente (sem quantidade). A quantidade vai no passo a passo.</p>
        {ingredients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag, ingredients, setIngredients)}
                  className="hover:bg-destructive/20 rounded-sm p-0.5"
                  aria-label={`Remover ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <AutocompleteTagInput
          value={ingredientInput}
          onChange={setIngredientInput}
          onAdd={(v) => addTag(v, ingredientSuggestions, ingredients, setIngredients)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (ingredientInput.trim()) {
                addTag(ingredientInput, ingredientSuggestions, ingredients, setIngredients);
                setIngredientInput('');
              }
            }
          }}
          suggestions={ingredientSuggestions}
          existingTags={ingredients}
          placeholder="Ex: gin, suco de limão, açúcar..."
        />
      </div>

      <div className="space-y-2">
        <Label>Passo a passo *</Label>
        <Textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="1. Adicione 50ml de gin no copo com gelo...&#10;2. Complete com 30ml de suco de limão..."
          rows={6}
        />
      </div>

      <div className="space-y-2">
        <Label>Características</Label>
        {characteristics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {characteristics.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag, characteristics, setCharacteristics)}
                  className="hover:bg-destructive/20 rounded-sm p-0.5"
                  aria-label={`Remover ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <AutocompleteTagInput
          value={characteristicInput}
          onChange={setCharacteristicInput}
          onAdd={(v) => addTag(v, characteristicSuggestions, characteristics, setCharacteristics)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              if (characteristicInput.trim()) {
                addTag(characteristicInput, characteristicSuggestions, characteristics, setCharacteristics);
                setCharacteristicInput('');
              }
            }
          }}
          suggestions={characteristicSuggestions}
          existingTags={characteristics}
          placeholder="Ex: cítrico, refrescante, alcoólico..."
        />
      </div>

      <div className="space-y-2">
        <Label>Descrição / Inspiração</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Conte a história, inspiração, o porquê do nome..." rows={4} />
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Publicar receita (+5 pts)
      </Button>
    </div>
  );
};

export default UserBatalhaNew;
