import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEbook, useCreateEbook, useUpdateEbook } from '@/hooks/useEbooks';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Upload, X, FileText, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const EbookForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: ebook, isLoading } = useEbook(id || '');
  const createEbook = useCreateEbook();
  const updateEbook = useUpdateEbook();
  const { upload: uploadImage, isUploading: isUploadingImage } = useImageUpload('package-covers', { skipOptimize: true });
  const { upload: uploadFile, isUploading: isUploadingFile } = useFileUpload('ebook-files');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);

  const handleSyncStripe = async () => {
    if (!id) return;
    const priceNum = parseFloat(String((ebook as any)?.price ?? ''));
    if (!priceNum || priceNum <= 0) {
      toast({
        title: 'Defina o preço primeiro',
        description: 'Cadastre um preço maior que zero e salve antes de sincronizar.',
        variant: 'destructive',
      });
      return;
    }
    setIsSyncingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-product', {
        body: { product_type: 'ebook', product_id: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'Sincronizado com Stripe!', description: 'Pronto para receber pagamentos.' });
      queryClient.invalidateQueries({ queryKey: ['ebooks'] });
      queryClient.invalidateQueries({ queryKey: ['ebook', id] });
    } catch (err: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingStripe(false);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    cover_image_url: '',
    file_url: '',
    price: '',
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    if (ebook) {
      setFormData({
        name: ebook.name,
        slug: ebook.slug || '',
        description: ebook.description || '',
        cover_image_url: ebook.cover_image_url || '',
        file_url: ebook.file_url || '',
        price: ebook.price ? String(ebook.price) : '',
        is_active: ebook.is_active ?? true,
        display_order: ebook.display_order ?? 0,
      });
    }
  }, [ebook]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug === '' || prev.slug === generateSlug(prev.name)
        ? generateSlug(value)
        : prev.slug,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadImage(file);
      if (url) setFormData((prev) => ({ ...prev, cover_image_url: url }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadFile(file);
      if (url) setFormData((prev) => ({ ...prev, file_url: url }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      cover_image_url: formData.cover_image_url || null,
      file_url: formData.file_url || null,
      price: formData.price ? parseFloat(formData.price) : null,
      is_active: formData.is_active,
      display_order: formData.display_order,
    };

    if (isEditing) {
      await updateEbook.mutateAsync({ id, data });
    } else {
      await createEbook.mutateAsync(data as any);
    }

    navigate('/admin/ebooks');
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/ebooks')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar E-book' : 'Novo E-book'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados do e-book' : 'Preencha os dados do novo e-book'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações do E-book</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Manual de Coquetéis Clássicos" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input id="slug" value={formData.slug} onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descreva o e-book..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input id="price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))} placeholder="0.00" />
                </div>
                {isEditing && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Checkout Stripe</Label>
                          {(ebook as any)?.stripe_price_id ? (
                            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/15">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-500/40">
                              <AlertCircle className="h-3 w-3 mr-1" /> Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sincronize para criar o produto e o preço no Stripe e habilitar a venda.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleSyncStripe} disabled={isSyncingStripe}>
                        {isSyncingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {(ebook as any)?.stripe_price_id ? 'Re-sincronizar' : 'Sincronizar com Stripe'}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="display_order">Ordem de Exibição</Label>
                  <Input id="display_order" type="number" min="0" value={formData.display_order} onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Arquivo PDF</CardTitle></CardHeader>
              <CardContent>
                {formData.file_url ? (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Arquivo enviado</p>
                      <a href={formData.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                        {formData.file_url.split('/').pop()}
                      </a>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFormData((prev) => ({ ...prev, file_url: '' }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-8 transition-colors hover:bg-muted">
                    <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={isUploadingFile} />
                    {isUploadingFile ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : (
                      <>
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Clique para enviar o PDF</span>
                      </>
                    )}
                  </label>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Imagem de Capa</CardTitle></CardHeader>
              <CardContent>
                {formData.cover_image_url ? (
                  <div className="relative">
                    <img src={formData.cover_image_url} alt="Preview" className="aspect-square w-full rounded-lg object-contain" />
                    <Button type="button" variant="destructive" size="icon" className="absolute right-2 top-2" onClick={() => setFormData((prev) => ({ ...prev, cover_image_url: '' }))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:bg-muted">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploadingImage} />
                    {isUploadingImage ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : (
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
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Ativo</Label>
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/ebooks')}>Cancelar</Button>
          <Button type="submit" disabled={createEbook.isPending || updateEbook.isPending}>
            {(createEbook.isPending || updateEbook.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar E-book'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EbookForm;
