import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCombo, useCreateCombo, useUpdateCombo, useComboCourses, useSaveComboCourses } from '@/hooks/useCombos';
import { useCourses } from '@/hooks/useCourses';
import { useEbooks } from '@/hooks/useEbooks';
import { useImageUpload } from '@/hooks/useImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Upload, X, BookOpen, FileText, Crown, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const ProdutoForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const queryClient = useQueryClient();

  const { data: combo, isLoading: isLoadingCombo } = useCombo(id || '');
  const { data: existingComboCourses = [] } = useComboCourses(id || '');
  const { data: allCourses = [] } = useCourses();
  const { data: allEbooks = [] } = useEbooks();
  const createCombo = useCreateCombo();
  const updateCombo = useUpdateCombo();
  const saveComboCourses = useSaveComboCourses();
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
    display_order: 0,
    workload_hours: 0,
    price: '',
    is_lifetime: false,
    includes_exclusive_access: false,
  });

  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [selectedEbookIds, setSelectedEbookIds] = useState<string[]>([]);

  useEffect(() => {
    if (combo) {
      setFormData({
        name: combo.name,
        slug: combo.slug || '',
        description: combo.description || '',
        cover_image_url: combo.cover_image_url || '',
        hotmart_product_code: combo.hotmart_product_code || '',
        woocommerce_product_id: combo.woocommerce_product_id || '',
        is_active: combo.is_active ?? true,
        is_free: combo.is_free ?? false,
        is_available_for_sale: combo.is_available_for_sale ?? true,
        display_order: combo.display_order ?? 0,
        workload_hours: (combo as any).workload_hours ?? 0,
        price: (combo as any).price ? String((combo as any).price) : '',
      });
    }
  }, [combo]);

  useEffect(() => {
    if (existingComboCourses.length > 0) {
      setSelectedCourseIds(existingComboCourses.map(cc => cc.course_id));
    }
  }, [existingComboCourses]);

  // Load existing ebook links
  useEffect(() => {
    if (id) {
      supabase
        .from('combo_ebooks')
        .select('ebook_id')
        .eq('combo_id', id)
        .then(({ data }) => {
          if (data) setSelectedEbookIds(data.map((d: any) => d.ebook_id));
        });
    }
  }, [id]);

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
      const url = await upload(file);
      if (url) setFormData((prev) => ({ ...prev, cover_image_url: url }));
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((i) => i !== courseId) : [...prev, courseId]
    );
  };

  const toggleEbook = (ebookId: string) => {
    setSelectedEbookIds((prev) =>
      prev.includes(ebookId) ? prev.filter((i) => i !== ebookId) : [...prev, ebookId]
    );
  };

  const saveComboEbooks = async (comboId: string, ebookIds: string[]) => {
    await supabase.from('combo_ebooks').delete().eq('combo_id', comboId);
    if (ebookIds.length > 0) {
      const rows = ebookIds.map((eid, idx) => ({
        combo_id: comboId,
        ebook_id: eid,
        display_order: idx,
      }));
      await supabase.from('combo_ebooks').insert(rows);
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
      display_order: formData.display_order,
      workload_hours: formData.workload_hours,
      price: formData.price ? parseFloat(formData.price) : null,
    } as any;

    let comboId: string;

    if (isEditing) {
      const result = await updateCombo.mutateAsync({ id, data });
      comboId = result.id;
    } else {
      const result = await createCombo.mutateAsync(data);
      comboId = result.id;
    }

    await saveComboCourses.mutateAsync({ comboId, courseIds: selectedCourseIds });
    await saveComboEbooks(comboId, selectedEbookIds);
    navigate('/admin/produtos');
  };

  if (isEditing && isLoadingCombo) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/produtos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados do produto' : 'Preencha os dados do novo produto'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações do Produto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Produto *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Combo Completo Criminal" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da URL *</Label>
                  <Input id="slug" value={formData.slug} onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))} required />
                  <p className="text-xs text-muted-foreground">URL da landing page: /{formData.slug || 'slug-aqui'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descreva o produto..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input id="price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))} placeholder="0.00" />
                </div>
                {!formData.is_free && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="hotmart_product_code">Link do Checkout</Label>
                      <Input id="hotmart_product_code" type="url" value={formData.hotmart_product_code} onChange={(e) => setFormData((prev) => ({ ...prev, hotmart_product_code: e.target.value }))} placeholder="https://www.criminallab.com.br/pagamento/nome-do-produto/" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="woocommerce_product_id">ID do Produto WooCommerce</Label>
                      <Input id="woocommerce_product_id" value={formData.woocommerce_product_id} onChange={(e) => setFormData((prev) => ({ ...prev, woocommerce_product_id: e.target.value }))} placeholder="Ex: 12345" />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workload_hours">Carga Horária (h)</Label>
                    <Input id="workload_hours" type="number" min="0" value={formData.workload_hours} onChange={(e) => setFormData((prev) => ({ ...prev, workload_hours: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_order">Ordem</Label>
                    <Input id="display_order" type="number" min="0" value={formData.display_order} onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cursos incluídos</CardTitle></CardHeader>
              <CardContent>
                {allCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum curso disponível</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedCourseIds.length} curso(s) selecionado(s)
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {allCourses.map((course) => (
                        <label key={course.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <Checkbox checked={selectedCourseIds.includes(course.id)} onCheckedChange={() => toggleCourse(course.id)} />
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {course.cover_image_url ? (
                              <img src={course.cover_image_url} alt={course.name} className="h-8 w-12 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="h-8 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <BookOpen className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm font-medium truncate">{course.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>E-books incluídos</CardTitle></CardHeader>
              <CardContent>
                {allEbooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum e-book disponível. <a href="/admin/ebooks/novo" className="text-primary hover:underline">Criar e-book</a></p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedEbookIds.length} e-book(s) selecionado(s)
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {allEbooks.map((ebook) => (
                        <label key={ebook.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                          <Checkbox checked={selectedEbookIds.includes(ebook.id)} onCheckedChange={() => toggleEbook(ebook.id)} />
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {ebook.cover_image_url ? (
                              <img src={ebook.cover_image_url} alt={ebook.name} className="h-8 w-12 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="h-8 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm font-medium truncate">{ebook.name}</span>
                          </div>
                          {ebook.price && (
                            <span className="text-xs text-muted-foreground">R$ {Number(ebook.price).toFixed(2)}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
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
                        <span className="text-sm text-muted-foreground">Clique para fazer upload</span>
                      </>
                    )}
                  </label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Ativo</Label>
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_free">Gratuito</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Acessível para todos</p>
                  </div>
                  <Switch id="is_free" checked={formData.is_free} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_free: checked }))} />
                </div>
                {!formData.is_free && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_available_for_sale">Disponível para Venda</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Exibir como opção de compra</p>
                    </div>
                    <Switch id="is_available_for_sale" checked={formData.is_available_for_sale} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_available_for_sale: checked }))} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/produtos')}>Cancelar</Button>
          <Button type="submit" disabled={createCombo.isPending || updateCombo.isPending || saveComboCourses.isPending}>
            {(createCombo.isPending || updateCombo.isPending || saveComboCourses.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProdutoForm;
