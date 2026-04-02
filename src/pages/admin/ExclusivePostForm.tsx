import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExclusivePost, useCreateExclusivePost, useUpdateExclusivePost } from '@/hooks/useExclusivePosts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
    description: '',
    youtube_url: '',
    cover_image_url: '',
    is_published: false,
    display_order: 0,
  });

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        description: post.description || '',
        youtube_url: post.youtube_url || '',
        cover_image_url: post.cover_image_url || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title: formData.title,
      description: formData.description || null,
      youtube_url: formData.youtube_url || null,
      cover_image_url: formData.cover_image_url || null,
      is_published: formData.is_published,
      display_order: formData.display_order,
    };

    if (isEditing) {
      await updatePost.mutateAsync({ id, data });
    } else {
      await createPost.mutateAsync(data as any);
    }

    navigate('/admin/conteudo-exclusivo');
  };

  if (isEditing && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Extract YouTube thumbnail
  const getYoutubeThumbnail = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?\s]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/conteudo-exclusivo')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Post' : 'Novo Post Exclusivo'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados do post' : 'Preencha os dados do novo post'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações do Post</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ex: Aula especial sobre jurisprudência" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descreva o conteúdo do post..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube_url">Link do Vídeo (YouTube)</Label>
                  <Input id="youtube_url" type="url" value={formData.youtube_url} onChange={(e) => setFormData((prev) => ({ ...prev, youtube_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." />
                  {formData.youtube_url && getYoutubeThumbnail(formData.youtube_url) && (
                    <div className="mt-2">
                      <img src={getYoutubeThumbnail(formData.youtube_url)!} alt="Thumbnail" className="rounded-lg w-full max-w-sm aspect-video object-cover" />
                    </div>
                  )}
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
              <CardHeader><CardTitle>Imagem de Capa</CardTitle></CardHeader>
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
                        <span className="text-sm text-muted-foreground">Upload da capa</span>
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
                    <Label htmlFor="is_published">Publicado</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Visível para assinantes</p>
                  </div>
                  <Switch id="is_published" checked={formData.is_published} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_published: checked }))} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/conteudo-exclusivo')}>Cancelar</Button>
          <Button type="submit" disabled={createPost.isPending || updatePost.isPending}>
            {(createPost.isPending || updatePost.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Post'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ExclusivePostForm;
