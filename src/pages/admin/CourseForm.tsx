import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourse, useCreateCourse, useUpdateCourse, useCoursePackages, useSaveCoursePackages } from '@/hooks/useCourses';
import { usePackages, useCreatePackage, useUpdatePackage, useDeletePackage } from '@/hooks/usePackages';
import { useRecipes, useDeleteRecipe } from '@/hooks/useRecipes';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Upload, X, GraduationCap, ChevronDown, ChevronRight, Plus, Pencil, Play, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InlineModule {
  id: string | null; // null = new, not yet saved
  name: string;
  isNew: boolean;
}

const CourseForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { toast } = useToast();

  const { data: course, isLoading: isLoadingCourse } = useCourse(id || '');
  const { data: existingCoursePackages = [] } = useCoursePackages(id || '');
  const { data: allPackages = [] } = usePackages();
  const { data: allLessons = [] } = useRecipes();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const saveCoursePackages = useSaveCoursePackages();
  const createPackage = useCreatePackage();
  const updatePackageMut = useUpdatePackage();
  const deletePackageMut = useDeletePackage();
  const { upload, isUploading } = useImageUpload('package-covers', { skipOptimize: true });

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

  const [modules, setModules] = useState<InlineModule[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string | number>>(new Set());
  const [editingModuleKey, setEditingModuleKey] = useState<string | number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const newModuleCounter = useRef(0);

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
    if (existingCoursePackages.length > 0 && allPackages.length > 0) {
      const sorted = [...existingCoursePackages].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const mods: InlineModule[] = sorted
        .map(cp => {
          const pkg = allPackages.find(p => p.id === cp.package_id);
          if (!pkg) return null;
          return { id: pkg.id, name: pkg.name, isNew: false };
        })
        .filter(Boolean) as InlineModule[];
      setModules(mods);
    }
  }, [existingCoursePackages, allPackages]);

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

  const toggleModuleExpand = (key: string | number) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addModule = () => {
    const tempKey = `new_${++newModuleCounter.current}`;
    const newMod: InlineModule = { id: null, name: '', isNew: true };
    setModules(prev => [...prev, newMod]);
    const idx = modules.length;
    setExpandedModules(prev => new Set(prev).add(idx));
    setEditingModuleKey(idx);
  };

  const updateModuleName = (index: number, name: string) => {
    setModules(prev => prev.map((m, i) => i === index ? { ...m, name } : m));
  };

  const removeModule = (index: number) => {
    setModules(prev => prev.filter((_, i) => i !== index));
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

    // Validate modules have names
    const emptyModules = modules.filter(m => !m.name.trim());
    if (emptyModules.length > 0) {
      toast({ title: 'Preencha o nome de todos os módulos', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      const courseData = {
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
        const result = await updateCourse.mutateAsync({ id, data: courseData });
        courseId = result.id;
      } else {
        const result = await createCourse.mutateAsync(courseData);
        courseId = result.id;
      }

      // Create new modules (packages) and collect all IDs
      const makeUniqueSlug = (base: string, excludeId?: string) => {
        const slug = base || `modulo-${Date.now()}`;
        const existing = allPackages.filter(p => p.id !== excludeId);
        if (!existing.some(p => p.slug === slug)) return slug;
        return `${slug}-${Date.now().toString(36)}`;
      };

      const packageIds: string[] = [];
      for (const mod of modules) {
        if (mod.id) {
          // Existing module - update name if changed
          const existing = allPackages.find(p => p.id === mod.id);
          if (existing && existing.name !== mod.name) {
            const newSlug = makeUniqueSlug(generateSlug(mod.name), mod.id);
            await updatePackageMut.mutateAsync({
              id: mod.id,
              data: { name: mod.name, slug: newSlug },
            });
          }
          packageIds.push(mod.id);
        } else {
          // New module - create package
          const slug = makeUniqueSlug(generateSlug(mod.name));
          const newPkg = await createPackage.mutateAsync({
            name: mod.name,
            slug,
            is_active: true,
            is_free: false,
            is_available_for_sale: false,
            lesson_order: 'asc',
            display_order: 0,
          } as any);
          packageIds.push(newPkg.id);
        }
      }

      await saveCoursePackages.mutateAsync({ courseId, packageIds });

      navigate('/admin/cursos');
    } catch (error) {
      console.error('Error saving course:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && isLoadingCourse) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={addModule}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Adicionar Módulo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {modules.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum módulo neste curso</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em "Adicionar Módulo" para criar uma seção</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modules.map((mod, idx) => {
                      const isExpanded = expandedModules.has(idx);
                      const isEditingName = editingModuleKey === idx;
                      const lessons = mod.id ? getLessonsForModule(mod.id) : [];

                      return (
                        <div key={mod.id || `new_${idx}`} className="rounded-lg border">
                          {/* Module Header */}
                          <div className="flex items-center gap-2 p-3">
                            <button
                              type="button"
                              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => toggleModuleExpand(idx)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>

                            <GraduationCap className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                            {isEditingName || mod.isNew ? (
                              <Input
                                value={mod.name}
                                onChange={(e) => updateModuleName(idx, e.target.value)}
                                onBlur={() => setEditingModuleKey(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setEditingModuleKey(null);
                                  }
                                }}
                                placeholder="Nome do módulo..."
                                className="h-8 text-sm font-medium"
                                autoFocus={mod.isNew}
                              />
                            ) : (
                              <span
                                className="text-sm font-medium flex-1 cursor-pointer hover:text-primary transition-colors"
                                onClick={() => setEditingModuleKey(idx)}
                                title="Clique para editar o nome"
                              >
                                {mod.name || 'Sem nome'}
                              </span>
                            )}

                            {!isEditingName && !mod.isNew && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {lessons.length} {lessons.length === 1 ? 'aula' : 'aulas'}
                              </span>
                            )}

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingModuleKey(idx)}
                                title="Renomear módulo"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeModule(idx)}
                                title="Remover módulo"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded: Lessons */}
                          {isExpanded && (
                            <div className="border-t bg-muted/10 px-3 pb-3">
                              {mod.id ? (
                                <>
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
                                      onClick={() => navigate(`/admin/aulas/nova?modulo=${mod.id}`)}
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      Nova Aula
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="py-4 text-center">
                                  <p className="text-xs text-muted-foreground">
                                    Salve o curso para poder adicionar aulas a este módulo
                                  </p>
                                </div>
                              )}
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
          <Button type="submit" disabled={isSaving}>
            {isSaving && (
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
