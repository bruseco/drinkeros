import React, { useState, useEffect, KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExclusivePost, useCreateExclusivePost, useUpdateExclusivePost } from '@/hooks/useExclusivePosts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';

const ExclusivePostForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: post, isLoading } = useExclusivePost(id || '');
  const createPost = useCreateExclusivePost();
  const updatePost = useUpdateExclusivePost();
  const { upload, isUploading } = useImageUpload('package-covers');

  const [formData, setFormData] = useState({
    title: '',
    cover_image_url: '',
    youtube_url: '',
    ingredients: [] as string[],
    instructions: '',
    characteristics: [] as string[],
    is_published: false,
    display_order: 0,
  });

  const [ingredientInput, setIngredientInput] = useState('');
  const [characteristicInput, setCharacteristicInput] = useState('');

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        cover_image_url: post.cover_image_url || '',
        youtube_url: post.youtube_url || '',
        ingredients: post.ingredients || [],
        instructions: post.instructions || '',
        characteristics: post.characteristics || [],
        is_published: post.is_published ?? false,
        display_order: post.display_order ?? 0,
      });
    }
  }, [post]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await upload(file);
      if (url) setFormData((prev) => ({ ...prev, cover_image_url: url }));
    }
  };

  const addTag = (field: 'ingredients' | 'characteristics', value: string) => {
    const trimmed = value.trim();
    if (trimmed && !formData[field].includes(trimmed)) {
      setFormData((prev) => ({ ...prev, [field]: [...prev[field], trimmed] }));
    }
  };

  const removeTag = (field: 'ingredients' | 'characteristics', index: number) => {
    setFormData((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const handleTagKeyDown = (field: 'ingredients' | 'characteristics', e: KeyboardEvent<HTMLInputElement>, value: string, setter: (v: string) => void) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(field, value);
      setter('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title: formData.title,
      description: null,
      youtube_url: null,
      cover_image_url: formData.cover_image_url || null,
      is_published: formData.is_published,
      display_order: formData.display_order,
      ingredients: formData.ingredients,
      instructions: formData.instructions || null,
      characteristics: formData.characteristics,
    };

    if (isEditing) {
      await updatePost.mutateAsync({ id, data });
    } else {
      await createPost.mutateAsync(data as any);
    }

    navigate('/admin/receitas');
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/receitas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Receita' : 'Nova Receita'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados da receita' : 'Preencha os dados da nova receita'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações da Receita</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ex: Caipirinha Clássica" required />
                </div>

                <div className="space-y-2">
                  <Label>Ingredientes</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.ingredients.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => removeTag('ingredients', i)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown('ingredients', e, ingredientInput, setIngredientInput)}
                    onBlur={() => { if (ingredientInput.trim()) { addTag('ingredients', ingredientInput); setIngredientInput(''); } }}
                    placeholder="Digite e pressione Enter para adicionar..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Modo de Preparo</Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData((prev) => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Descreva o modo de preparo da receita..."
                    rows={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Características</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.characteristics.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => removeTag('characteristics', i)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={characteristicInput}
                    onChange={(e) => setCharacteristicInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown('characteristics', e, characteristicInput, setCharacteristicInput)}
                    onBlur={() => { if (characteristicInput.trim()) { addTag('characteristics', characteristicInput); setCharacteristicInput(''); } }}
                    placeholder="Ex: Refrescante, Alcoólico, Tropical..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">Ordem de Exibição</Label>
                  <Input id="display_order" type="number" min="0" value={formData.display_order} onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Capa</CardTitle></CardHeader>
              <CardContent>
                {formData.cover_image_url ? (
                  <div className="relative">
                    <img src={formData.cover_image_url} alt="Preview" className="aspect-video w-full rounded-lg object-cover" />
                    <Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2" onClick={() => setFormData((prev) => ({ ...prev, cover_image_url: '' }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:bg-muted">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                    {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : (
                      <>
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Upload da capa (16:9)</span>
                      </>
                    )}
                  </label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Publicação</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_published">Publicada</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Visível para os usuários</p>
                  </div>
                  <Switch id="is_published" checked={formData.is_published} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_published: checked }))} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/receitas')}>Cancelar</Button>
          <Button type="submit" disabled={createPost.isPending || updatePost.isPending}>
            {(createPost.isPending || updatePost.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Receita'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ExclusivePostForm;
