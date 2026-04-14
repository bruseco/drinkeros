import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePackage, useCreatePackage, useUpdatePackage } from '@/hooks/usePackages';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';

const PackageForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: pkg, isLoading: isLoadingPackage } = usePackage(id || '');
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();
  const { upload, isUploading } = useImageUpload('package-covers');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    cover_image_url: '',
    hotmart_product_code: '',
    woocommerce_product_id: '',
    is_active: true,
    is_free: false,
    is_available_for_sale: true,
    lesson_order: 'asc',
    display_order: 0,
    workload_hours: 0,
  });

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name,
        slug: pkg.slug || '',
        description: pkg.description || '',
        cover_image_url: pkg.cover_image_url || '',
        hotmart_product_code: pkg.hotmart_product_code || '',
        woocommerce_product_id: (pkg as any).woocommerce_product_id || '',
        is_active: pkg.is_active ?? true,
        is_free: (pkg as any).is_free ?? false,
        is_available_for_sale: (pkg as any).is_available_for_sale ?? true,
        lesson_order: (pkg as any).lesson_order || 'asc',
        display_order: pkg.display_order ?? 0,
        workload_hours: (pkg as any).workload_hours ?? 0,
      });
    }
  }, [pkg]);

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      // Only auto-generate slug if it's empty or matches previous auto-generated slug
      slug: prev.slug === '' || prev.slug === generateSlug(prev.name) 
        ? generateSlug(value) 
        : prev.slug,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await upload(file);
      if (url) {
        setFormData((prev) => ({ ...prev, cover_image_url: url }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      cover_image_url: formData.cover_image_url || null,
      hotmart_product_code: formData.is_free ? null : (formData.hotmart_product_code || null),
      woocommerce_product_id: formData.is_free ? null : (formData.woocommerce_product_id || null),
      is_active: formData.is_active,
      is_free: formData.is_free,
      is_available_for_sale: formData.is_free ? false : formData.is_available_for_sale,
      lesson_order: formData.lesson_order,
      display_order: formData.display_order,
      workload_hours: formData.workload_hours,
    } as any;

    if (isEditing) {
      await updatePackage.mutateAsync({ id, data });
    } else {
      await createPackage.mutateAsync(data);
    }

    navigate('/admin/modulos');
  };

  if (isEditing && isLoadingPackage) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/modulos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Módulo' : 'Novo Módulo'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados do módulo' : 'Preencha os dados do novo módulo'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Módulo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Módulo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Drinks Clássicos - Módulo Básico"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da URL *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="ex: direito-penal-parte-geral"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    URL da landing page: /{formData.slug || 'slug-aqui'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o módulo..."
                    rows={3}
                  />
                </div>

                {!formData.is_free && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="hotmart_product_code">Link do Checkout</Label>
                      <Input
                        id="hotmart_product_code"
                        type="url"
                        value={formData.hotmart_product_code}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, hotmart_product_code: e.target.value }))
                        }
                        placeholder="https://www.criminallab.com.br/pagamento/nome-do-produto/"
                      />
                      <p className="text-xs text-muted-foreground">
                        URL completa da página de checkout para este módulo
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="woocommerce_product_id">ID do Produto WooCommerce</Label>
                      <Input
                        id="woocommerce_product_id"
                        value={formData.woocommerce_product_id}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, woocommerce_product_id: e.target.value }))
                        }
                        placeholder="Ex: 12345"
                      />
                      <p className="text-xs text-muted-foreground">
                        ID do produto no WooCommerce. Usado para mapear compras via webhook.
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="workload_hours">Carga Horária (horas)</Label>
                  <Input
                    id="workload_hours"
                    type="number"
                    min="0"
                    value={formData.workload_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, workload_hours: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">Ordem de Exibição</Label>
                  <Input
                    id="display_order"
                    type="number"
                    min="0"
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Imagem de Capa</CardTitle>
              </CardHeader>
              <CardContent>
                {formData.cover_image_url ? (
                  <div className="relative">
                    <img
                      src={formData.cover_image_url}
                      alt="Preview"
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => setFormData((prev) => ({ ...prev, cover_image_url: '' }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:bg-muted">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Clique para fazer upload
                        </span>
                      </>
                    )}
                  </label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Módulo Ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_free">Módulo Gratuito</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acessível para todos os usuários
                    </p>
                  </div>
                  <Switch
                    id="is_free"
                    checked={formData.is_free}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_free: checked }))
                    }
                  />
                </div>
                {!formData.is_free && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_available_for_sale">Disponível para Venda</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Exibir para usuários como opção de compra
                      </p>
                    </div>
                    <Switch
                      id="is_available_for_sale"
                      checked={formData.is_available_for_sale}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_available_for_sale: checked }))
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ordem das Aulas</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={formData.lesson_order}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, lesson_order: value }))
                  }
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="asc" id="order_asc" className="mt-0.5" />
                    <div>
                      <Label htmlFor="order_asc" className="cursor-pointer">Crescente</Label>
                      <p className="text-xs text-muted-foreground">1, 2, 3... (padrão)</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="desc" id="order_desc" className="mt-0.5" />
                    <div>
                      <Label htmlFor="order_desc" className="cursor-pointer">Decrescente</Label>
                      <p className="text-xs text-muted-foreground">...3, 2, 1</p>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/modulos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createPackage.isPending || updatePackage.isPending}>
            {(createPackage.isPending || updatePackage.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditing ? 'Salvar Alterações' : 'Criar Módulo'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PackageForm;
