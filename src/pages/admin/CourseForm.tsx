import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCourse, useCreateCourse, useUpdateCourse, useCoursePackages, useSaveCoursePackages } from '@/hooks/useCourses';
import { usePackages } from '@/hooks/usePackages';
import { useRecipes } from '@/hooks/useRecipes';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Loader2, Upload, X, GraduationCap, Search, ChevronDown, ChevronRight, Plus, Pencil, Play } from 'lucide-react';

const CourseForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: course, isLoading: isLoadingCourse } = useCourse(id || '');
  const { data: existingCoursePackages = [] } = useCoursePackages(id || '');
  const { data: allPackages = [] } = usePackages();
  const { data: allLessons = [] } = useRecipes();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const saveCoursePackages = useSaveCoursePackages();
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
  });

  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [moduleSearch, setModuleSearch] = useState('');
  const [showModuleSelector, setShowModuleSelector] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (course) {
      setFormData({
        name: course.name,
        slug: course.slug || '',
        description: course.description || '',
        cover_image_url: course.cover_image_url || '',
        hotmart_product_code: course.hotmart_product_code || '',
        woocommerce_product_id: course.woocommerce_product_id || '',
        is_active: course.is_active ?? true,
        is_free: course.is_free ?? false,
        is_available_for_sale: course.is_available_for_sale ?? true,
        display_order: course.display_order ?? 0,
        workload_hours: (course as any).workload_hours ?? 0,
      });
    }
  }, [course]);

  useEffect(() => {
    if (existingCoursePackages.length > 0) {
      setSelectedPackageIds(existingCoursePackages.map(cp => cp.package_id));
    }
  }, [existingCoursePackages]);

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

  const togglePackage = (packageId: string) => {
    setSelectedPackageIds((prev) =>
      prev.includes(packageId)
        ? prev.filter((pid) => pid !== packageId)
        : [...prev, packageId]
    );
  };

  const toggleModuleExpand = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const getLessonsForModule = (moduleId: string) => {
    return (allLessons as any[]).filter((lesson: any) =>
      lesson.recipe_packages?.some((rp: any) => rp.package_id === moduleId)
    ).sort((a: any, b: any) => {
      const aOrder = a.recipe_packages?.find((rp: any) => rp.package_id === moduleId)?.display_order ?? 999;
      const bOrder = b.recipe_packages?.find((rp: any) => rp.package_id === moduleId)?.display_order ?? 999;
      return aOrder - bOrder;
    });
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
    } as any;

    let courseId: string;

    if (isEditing) {
      const result = await updateCourse.mutateAsync({ id, data });
      courseId = result.id;
    } else {
      const result = await createCourse.mutateAsync(data);
      courseId = result.id;
    }

    await saveCoursePackages.mutateAsync({ courseId, packageIds: selectedPackageIds });

    navigate('/admin/cursos');
  };

  if (isEditing && isLoadingCourse) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedModules = selectedPackageIds
    .map(pid => allPackages.find(p => p.id === pid))
    .filter(Boolean);

  const unselectedPackages = allPackages
    .filter(pkg => !selectedPackageIds.includes(pkg.id))
    .filter(pkg => pkg.name.toLowerCase().includes(moduleSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/cursos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Curso' : 'Novo Curso'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados do curso' : 'Preencha os dados do novo curso'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Curso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Curso *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Formação Completa em Direito Penal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da URL *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="ex: formacao-direito-penal"
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
                    placeholder="Descreva o curso..."
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
                        URL completa da página de checkout para este curso
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

            {/* Modules & Lessons Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Módulos e Aulas</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowModuleSelector(!showModuleSelector)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Vincular Módulo
                    </Button>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => navigate('/admin/modulos/novo')}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Novo Módulo
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Module Selector (toggle) */}
                {showModuleSelector && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar módulo para vincular..."
                        value={moduleSearch}
                        onChange={(e) => setModuleSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {unselectedPackages.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 text-center">
                          Nenhum módulo disponível
                        </p>
                      ) : (
                        unselectedPackages.map((pkg) => (
                          <label
                            key={pkg.id}
                            className="flex items-center gap-3 rounded-md border bg-background p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => {
                                togglePackage(pkg.id);
                              }}
                            />
                            <span className="text-sm">{pkg.name}</span>
                            {!pkg.is_active && (
                              <Badge variant="secondary" className="text-xs ml-auto">Inativo</Badge>
                            )}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Modules with Expandable Lessons */}
                {selectedModules.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum módulo vinculado a este curso</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em "Vincular Módulo" para adicionar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedModules.map((mod, idx) => {
                      if (!mod) return null;
                      const isExpanded = expandedModules.has(mod.id);
                      const lessons = getLessonsForModule(mod.id);

                      return (
                        <div key={mod.id} className="rounded-lg border">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleModuleExpand(mod.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            {mod.cover_image_url ? (
                              <img
                                src={mod.cover_image_url}
                                alt={mod.name}
                                className="h-8 w-12 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <GraduationCap className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate block">{mod.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => navigate(`/admin/modulos/${mod.id}`)}
                                title="Editar módulo"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => togglePackage(mod.id)}
                                title="Desvincular módulo"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t bg-muted/10 px-3 pb-3">
                              {lessons.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-3 text-center">
                                  Nenhuma aula neste módulo
                                </p>
                              ) : (
                                <div className="space-y-1 pt-2">
                                  {lessons.map((lesson: any, lessonIdx: number) => (
                                    <div
                                      key={lesson.id}
                                      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors group"
                                    >
                                      <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">
                                        {lessonIdx + 1}.
                                      </span>
                                      {lesson.image_url ? (
                                        <img
                                          src={lesson.image_url}
                                          alt={lesson.name}
                                          className="h-6 w-10 rounded object-cover flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="h-6 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                          <Play className="h-2.5 w-2.5 text-muted-foreground" />
                                        </div>
                                      )}
                                      <span className="text-sm truncate flex-1">{lesson.name}</span>
                                      <Badge
                                        variant={lesson.status === 'published' ? 'default' : 'secondary'}
                                        className="text-xs flex-shrink-0"
                                      >
                                        {lesson.status === 'published' ? 'Publicada' : 'Rascunho'}
                                      </Badge>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                        onClick={() => navigate(`/admin/aulas/${lesson.id}`)}
                                        title="Editar aula"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="pt-2 border-t mt-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={() => navigate('/admin/aulas/nova')}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Nova Aula
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <Label htmlFor="is_active">Curso Ativo</Label>
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
                    <Label htmlFor="is_free">Curso Gratuito</Label>
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
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/cursos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createCourse.isPending || updateCourse.isPending || saveCoursePackages.isPending}>
            {(createCourse.isPending || updateCourse.isPending || saveCoursePackages.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditing ? 'Salvar Alterações' : 'Criar Curso'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CourseForm;
