import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCombo, useCreateCombo, useUpdateCombo, useComboCourses, useSaveComboCourses } from '@/hooks/useCombos';
import { useCourses } from '@/hooks/useCourses';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Upload, X, BookOpen } from 'lucide-react';

const ComboForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: combo, isLoading: isLoadingCombo } = useCombo(id || '');
  const { data: existingComboCourses = [] } = useComboCourses(id || '');
  const { data: allCourses = [] } = useCourses();
  const createCombo = useCreateCombo();
  const updateCombo = useUpdateCombo();
  const saveComboCourses = useSaveComboCourses();
  const { upload, isUploading } = useImageUpload('package-covers');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    cover_image_url: '',
    checkout_url: '',
    is_active: true,
    is_free: false,
    is_available_for_sale: true,
    display_order: 0,
    workload_hours: 0,
  });

  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    if (combo) {
      setFormData({
        name: combo.name,
        slug: combo.slug || '',
        description: combo.description || '',
        cover_image_url: combo.cover_image_url || '',
        checkout_url: combo.checkout_url || '',
        is_active: combo.is_active ?? true,
        is_free: combo.is_free ?? false,
        is_available_for_sale: combo.is_available_for_sale ?? true,
        display_order: combo.display_order ?? 0,
        workload_hours: (combo as any).workload_hours ?? 0,
      });
    }
  }, [combo]);

  useEffect(() => {
    if (existingComboCourses.length > 0) {
      setSelectedCourseIds(existingComboCourses.map(cc => cc.course_id));
    }
  }, [existingComboCourses]);

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
      if (url) {
        setFormData((prev) => ({ ...prev, cover_image_url: url }));
      }
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description || null,
      cover_image_url: formData.cover_image_url || null,
      checkout_url: formData.is_free ? null : (formData.checkout_url || null),
      is_active: formData.is_active,
      is_free: formData.is_free,
      is_available_for_sale: formData.is_free ? false : formData.is_available_for_sale,
      display_order: formData.display_order,
      workload_hours: formData.workload_hours,
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
    navigate('/admin/combos');
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/combos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Combo' : 'Novo Combo'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados do combo' : 'Preencha os dados do novo combo'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações do Combo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Combo *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Super Combo Criminal" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da URL *</Label>
                  <Input id="slug" value={formData.slug} onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))} placeholder="ex: super-combo-criminal" required />
                  <p className="text-xs text-muted-foreground">URL da landing page: /{formData.slug || 'slug-aqui'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descreva o combo..." rows={3} />
                </div>
                {!formData.is_free && (
                  <div className="space-y-2">
                    <Label htmlFor="checkout_url">Link do Checkout (Stripe ou Mercado Pago)</Label>
                    <Input id="checkout_url" type="url" value={formData.checkout_url} onChange={(e) => setFormData((prev) => ({ ...prev, checkout_url: e.target.value }))} placeholder="https://drinkeros.com/checkout/..." />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="workload_hours">Carga Horária (horas)</Label>
                  <Input id="workload_hours" type="number" min="0" value={formData.workload_hours} onChange={(e) => setFormData((prev) => ({ ...prev, workload_hours: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_order">Ordem de Exibição</Label>
                  <Input id="display_order" type="number" min="0" value={formData.display_order} onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Cursos do Combo</CardTitle></CardHeader>
              <CardContent>
                {allCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum curso disponível</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Selecione os cursos que fazem parte deste combo ({selectedCourseIds.length} selecionados)
                    </p>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
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
                          {!course.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                        </label>
                      ))}
                    </div>
                    {selectedCourseIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                        {selectedCourseIds.map((cid) => {
                          const course = allCourses.find((c) => c.id === cid);
                          return course ? (
                            <Badge key={cid} variant="secondary" className="gap-1">
                              {course.name}
                              <button type="button" onClick={() => toggleCourse(cid)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
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
                  <Label htmlFor="is_active">Combo Ativo</Label>
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_free">Combo Gratuito</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Acessível para todos os usuários</p>
                  </div>
                  <Switch id="is_free" checked={formData.is_free} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_free: checked }))} />
                </div>
                {!formData.is_free && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_available_for_sale">Disponível para Venda</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Exibir para usuários como opção de compra</p>
                    </div>
                    <Switch id="is_available_for_sale" checked={formData.is_available_for_sale} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_available_for_sale: checked }))} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/combos')}>Cancelar</Button>
          <Button type="submit" disabled={createCombo.isPending || updateCombo.isPending || saveComboCourses.isPending}>
            {(createCombo.isPending || updateCombo.isPending || saveComboCourses.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Combo'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ComboForm;
