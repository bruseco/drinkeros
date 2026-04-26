import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

const UserClubNew: React.FC = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [characteristics, setCharacteristics] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim() || !ingredients.trim() || !instructions.trim()) {
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
      const chars = characteristics.split(',').map(c => c.trim()).filter(Boolean);
      const { error } = await supabase.from('club_recipes').insert({
        user_id: user.id,
        name: name.trim(),
        image_url,
        ingredients: ingredients.trim(),
        instructions: instructions.trim(),
        characteristics: chars,
        description: description.trim() || null,
      });
      if (error) throw error;
      toast.success('Receita publicada! +5 pontos 🎉');
      nav('/app/clube');
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
        <Textarea value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="50ml de gin&#10;30ml de suco de limão&#10;..." rows={5} />
      </div>

      <div className="space-y-2">
        <Label>Passo a passo *</Label>
        <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="1. Adicione gelo no copo...&#10;2. ..." rows={6} />
      </div>

      <div className="space-y-2">
        <Label>Características (separe por vírgula)</Label>
        <Input value={characteristics} onChange={e => setCharacteristics(e.target.value)} placeholder="cítrico, refrescante, alcoólico" />
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

export default UserClubNew;
