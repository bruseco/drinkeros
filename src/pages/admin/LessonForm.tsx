import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRecipe, useCreateRecipe, useUpdateRecipe } from '@/hooks/useRecipes';
import { usePackages } from '@/hooks/usePackages';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Upload, X, Play, AlertCircle, FileDown, File, Video, FileText } from 'lucide-react';
import { toast } from 'sonner';

type ThumbnailOption = { time: number; url: string; label: string };

type VideoPlatform = 'vimeo' | 'youtube' | null;

const extractYouTubeId = (url: string): string | null => {
  const regExp = /^.*(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11}).*/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

const isValidYouTubeUrl = (url: string): boolean => {
  return !!extractYouTubeId(url);
};

const detectPlatform = (url: string): VideoPlatform => {
  if (/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/.test(url)) return 'vimeo';
  if (isValidYouTubeUrl(url)) return 'youtube';
  return null;
};

const LessonForm: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedModule = searchParams.get('modulo');
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const { data: lesson, isLoading: isLoadingLesson } = useRecipe(id || '');
  const { data: modules = [] } = usePackages();
  const createLesson = useCreateRecipe();
  const updateLesson = useUpdateRecipe();
  const { upload, isUploading } = useImageUpload('recipe-images');
  const { upload: uploadMaterial, isUploading: isUploadingMaterial } = useFileUpload('lesson-materials');

  const [formData, setFormData] = useState({
    name: '',
    image_url: '',
    servings: '', // used as duration
    ingredients: '', // used as description
    instructions: '', // used as notes/material
    video_url: '',
    material_url: '',
    transcript: '',
    status: 'draft' as 'draft' | 'published',
    duration_seconds: 0,
  });
  const [materials, setMaterials] = useState<{ id?: string; name: string; file_url: string }[]>([]);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [moduleOrders, setModuleOrders] = useState<Record<string, number>>({});
  const [isFetchingThumb, setIsFetchingThumb] = useState(false);
  const [thumbnailOptions, setThumbnailOptions] = useState<ThumbnailOption[]>([]);
  const [selectedThumbIndex, setSelectedThumbIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lesson) {
      setFormData({
        name: lesson.name,
        image_url: lesson.image_url || '',
        servings: lesson.servings || '',
        ingredients: lesson.ingredients || '',
        instructions: lesson.instructions || '',
        video_url: lesson.video_url || '',
        material_url: lesson.material_url || '',
        transcript: (lesson as any).transcript || '',
        status: lesson.status,
        duration_seconds: (lesson as any).duration_seconds || 0,
      });
      setSelectedModules(lesson.recipe_packages.map((rp) => rp.package_id));
      const orders: Record<string, number> = {};
      lesson.recipe_packages.forEach((rp) => {
        orders[rp.package_id] = rp.display_order ?? 0;
      });
      setModuleOrders(orders);

      // Load materials
      supabase
        .from('recipe_materials')
        .select('id, name, file_url')
        .eq('recipe_id', lesson.id)
        .order('display_order')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setMaterials(data);
          }
        });
    }
  }, [lesson]);

  // Pre-select module from query param when creating a new lesson
  useEffect(() => {
    if (!isEditing && preselectedModule && selectedModules.length === 0) {
      setSelectedModules([preselectedModule]);
    }
  }, [isEditing, preselectedModule]);

  const fetchVimeoData = async (videoUrl: string, force = false): Promise<{ thumbnails: ThumbnailOption[]; duration?: number }> => {
    const match = videoUrl.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (!match) return { thumbnails: [] };

    setIsFetchingThumb(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('vimeo-thumbnails', {
        body: { videoUrl },
      });

      if (res.error) {
        // Parse error message for better feedback
        const errorBody = typeof res.error === 'object' && 'message' in res.error
          ? res.error.message
          : String(res.error);
        console.error('Vimeo edge function error:', errorBody);
        throw new Error(errorBody);
      }
      const data = res.data as { thumbnails: ThumbnailOption[]; duration?: number; resolvedUrl?: string };
      
      // Auto-update video URL with privacy hash if resolved
      if (data.resolvedUrl && videoUrl !== data.resolvedUrl) {
        const currentHasHash = /vimeo\.com\/\d+\/[a-zA-Z0-9]+/.test(videoUrl);
        const resolvedHasHash = /vimeo\.com\/\d+\/[a-zA-Z0-9]+/.test(data.resolvedUrl);
        if (!currentHasHash && resolvedHasHash) {
          setFormData(prev => ({ ...prev, video_url: data.resolvedUrl! }));
          toast.info('URL do Vimeo atualizada com hash de privacidade');
        }
      }
      
      return { thumbnails: data.thumbnails || [], duration: data.duration };
    } catch (err: any) {
      console.error('Vimeo thumbnails error:', err);
      // Fallback to oEmbed single thumbnail + duration
      try {
        const vimeoUrl = match[2] ? `https://vimeo.com/${match[1]}/${match[2]}` : `https://vimeo.com/${match[1]}`;
        const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}`);
        if (!res.ok) throw new Error('oEmbed error');
        const data = await res.json();
        let thumbUrl = data.thumbnail_url || '';
        thumbUrl = thumbUrl.replace(/_\d+x?\d*\./, '_1280.');
        const fallbackDuration = data.duration as number | undefined;
        if (thumbUrl) {
          return { thumbnails: [{ time: 0, url: thumbUrl, label: 'Padrão' }], duration: fallbackDuration };
        }
        return { thumbnails: [], duration: fallbackDuration };
      } catch {
        // ignore fallback error
      }
      if (force) {
        const msg = err?.message?.includes('not found')
          ? 'Vídeo não encontrado. Verifique a URL e se o token Vimeo tem acesso a este vídeo.'
          : 'Não foi possível buscar thumbnails do Vimeo';
        toast.error(msg);
      }
      return { thumbnails: [] };
    } finally {
      setIsFetchingThumb(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}min`;
    if (m > 0) return `${m} min`;
    return `${s} seg`;
  };

  const fetchYouTubeDuration = (videoId: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10000);

      const containerId = `yt-duration-${Date.now()}`;
      const container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '1px';
      container.style.height = '1px';
      document.body.appendChild(container);

      const createPlayer = () => {
        // @ts-ignore
        new window.YT.Player(containerId, {
          videoId,
          events: {
            onReady: (event: any) => {
              clearTimeout(timeout);
              const dur = event.target.getDuration();
              event.target.destroy();
              container.remove();
              resolve(dur && dur > 0 ? Math.round(dur) : null);
            },
            onError: () => {
              clearTimeout(timeout);
              container.remove();
              resolve(null);
            },
          },
        });
      };

      // @ts-ignore
      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        // Load the IFrame API if not yet loaded
        // @ts-ignore
        const prevCallback = window.onYouTubeIframeAPIReady;
        // @ts-ignore
        window.onYouTubeIframeAPIReady = () => {
          // @ts-ignore
          if (prevCallback) prevCallback();
          createPlayer();
        };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
        }
      }
    });
  };

  const fetchYouTubeData = async (videoUrl: string, force = false): Promise<{ thumbnails: ThumbnailOption[]; duration?: number }> => {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) return { thumbnails: [] };

    setIsFetchingThumb(true);
    try {
      // YouTube public thumbnail URLs
      const candidates = [
        { url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, label: 'HD' },
        { url: `https://img.youtube.com/vi/${videoId}/0.jpg`, label: 'Padrão' },
        { url: `https://img.youtube.com/vi/${videoId}/1.jpg`, label: 'Frame 1' },
        { url: `https://img.youtube.com/vi/${videoId}/2.jpg`, label: 'Frame 2' },
        { url: `https://img.youtube.com/vi/${videoId}/3.jpg`, label: 'Frame 3' },
      ];

      // Fetch thumbnails and duration in parallel
      const [thumbnailResults, duration] = await Promise.all([
        Promise.all(
          candidates.map(async (c) => {
            try {
              const res = await fetch(c.url, { method: 'HEAD' });
              if (res.ok) {
                return { time: 0, url: c.url, label: c.label };
              }
              return null;
            } catch {
              return null;
            }
          })
        ),
        fetchYouTubeDuration(videoId),
      ]);

      const thumbnails = thumbnailResults.filter(Boolean) as ThumbnailOption[];

      if (thumbnails.length === 0 && force) {
        toast.error('Não foi possível buscar thumbnails do YouTube');
      }

      return { thumbnails, duration: duration ?? undefined };
    } catch (err) {
      console.error('YouTube thumbnails error:', err);
      if (force) {
        toast.error('Erro ao buscar dados do YouTube');
      }
      return { thumbnails: [] };
    } finally {
      setIsFetchingThumb(false);
    }
  };

  const handleFetchVideoThumb = async () => {
    const platform = detectPlatform(formData.video_url);

    if (platform === 'vimeo') {
      const { thumbnails: options, duration } = await fetchVimeoData(formData.video_url, true);
      if (options.length > 0) {
        setThumbnailOptions(options);
        setSelectedThumbIndex(null);
        toast.success(`${options.length} thumbnail(s) encontrada(s)`);
      }
      if (duration) {
        if (!formData.servings) setFormData(prev => ({ ...prev, servings: formatDuration(duration) }));
        setFormData(prev => ({ ...prev, duration_seconds: duration }));
      }
    } else if (platform === 'youtube') {
      const { thumbnails: options, duration } = await fetchYouTubeData(formData.video_url, true);
      if (options.length > 0) {
        setThumbnailOptions(options);
        setSelectedThumbIndex(null);
        toast.success(`${options.length} thumbnail(s) encontrada(s)`);
      }
      if (duration) {
        if (!formData.servings) setFormData(prev => ({ ...prev, servings: formatDuration(duration) }));
        setFormData(prev => ({ ...prev, duration_seconds: duration }));
      }
    }
  };

  // Auto-fetch thumbnails when video URL changes
  useEffect(() => {
    if (!formData.video_url || formData.image_url) return;
    const platform = detectPlatform(formData.video_url);
    if (!platform) return;

    const timer = setTimeout(async () => {
      if (platform === 'vimeo') {
        const { thumbnails: options, duration } = await fetchVimeoData(formData.video_url);
        if (options.length > 0) {
          setThumbnailOptions(options);
          setSelectedThumbIndex(0);
          setFormData((prev) => {
            const updates: Partial<typeof prev> = {};
            if (!prev.image_url) updates.image_url = options[0].url;
            if (!prev.servings && duration) updates.servings = formatDuration(duration);
            if (duration) updates.duration_seconds = duration;
            return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
          });
        } else if (duration) {
          setFormData((prev) => ({
            ...prev,
            ...(!prev.servings ? { servings: formatDuration(duration) } : {}),
            duration_seconds: duration,
          }));
        }
      } else if (platform === 'youtube') {
        const { thumbnails: options, duration } = await fetchYouTubeData(formData.video_url);
        if (options.length > 0) {
          setThumbnailOptions(options);
          setSelectedThumbIndex(0);
          setFormData((prev) => {
            const updates: Partial<typeof prev> = {};
            if (!prev.image_url) updates.image_url = options[0].url;
            if (!prev.servings && duration) updates.servings = formatDuration(duration);
            if (duration) updates.duration_seconds = duration;
            return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
          });
        } else if (duration) {
          setFormData((prev) => ({
            ...prev,
            ...(!prev.servings ? { servings: formatDuration(duration) } : {}),
            duration_seconds: duration,
          }));
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.video_url]);

  // Clear thumbnail options when video URL changes to a different video
  useEffect(() => {
    setThumbnailOptions([]);
    setSelectedThumbIndex(null);
  }, [formData.video_url]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await upload(file);
      if (url) {
        setFormData((prev) => ({ ...prev, image_url: url }));
        setThumbnailOptions([]);
        setSelectedThumbIndex(null);
      }
    }
  };

  const handleSelectThumbnail = (index: number) => {
    setSelectedThumbIndex(index);
    setFormData((prev) => ({ ...prev, image_url: thumbnailOptions[index].url }));
  };

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const url = await uploadMaterial(file);
      if (url) {
        const name = file.name.replace(/\.[^/.]+$/, '');
        setMaterials((prev) => [...prev, { name, file_url: url }]);
      }
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMaterialNameChange = (index: number, newName: string) => {
    setMaterials((prev) => prev.map((m, i) => i === index ? { ...m, name: newName } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const packageData = selectedModules.map((modId) => ({
      packageId: modId,
      displayOrder: moduleOrders[modId] ?? 0,
    }));

    let recipeId = id;

    if (isEditing) {
      await updateLesson.mutateAsync({
        id,
        data: formData,
        packageData,
      });
    } else {
      const result = await createLesson.mutateAsync({
        recipe: {
          ...formData,
          created_by: user?.id || null,
        },
        packageData,
      });
      recipeId = result?.id;
    }

    // Save materials
    if (recipeId) {
      // Delete existing materials
      await supabase.from('recipe_materials').delete().eq('recipe_id', recipeId);
      // Insert current materials
      if (materials.length > 0) {
        await supabase.from('recipe_materials').insert(
          materials.map((m, i) => ({
            recipe_id: recipeId!,
            name: m.name,
            file_url: m.file_url,
            display_order: i,
          }))
        );
      }
    }

    navigate('/admin/aulas');
  };

  const toggleModule = async (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      // Desmarcando: remover do state
      setSelectedModules(prev => prev.filter(id => id !== moduleId));
      setModuleOrders(o => {
        const copy = { ...o };
        delete copy[moduleId];
        return copy;
      });
    } else {
      // Marcando: buscar max display_order e sugerir próximo
      setSelectedModules(prev => [...prev, moduleId]);

      const { data } = await supabase
        .from('recipe_packages')
        .select('display_order')
        .eq('package_id', moduleId)
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = data?.[0]?.display_order ?? 0;
      setModuleOrders(prev => ({
        ...prev,
        [moduleId]: maxOrder + 1,
      }));
    }
  };


  const getVideoEmbedUrl = (url: string) => {
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (vimeoMatch) {
      const hash = vimeoMatch[2];
      return `https://player.vimeo.com/video/${vimeoMatch[1]}${hash ? `?h=${hash}` : ''}`;
    }
    const ytId = extractYouTubeId(url);
    if (ytId) {
      return `https://www.youtube-nocookie.com/embed/${ytId}?modestbranding=1&rel=0&iv_load_policy=3&showinfo=0`;
    }
    return null;
  };

  if (isEditing && isLoadingLesson) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const embedUrl = formData.video_url ? getVideoEmbedUrl(formData.video_url) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/aulas')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Editar Aula' : 'Nova Aula'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'Atualize os dados da aula' : 'Preencha os dados da nova aula'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Aula</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Aula *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Introdução ao Direito Penal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video_url">URL do Vídeo (Vimeo ou YouTube) *</Label>
                  <Input
                    id="video_url"
                    type="url"
                    value={formData.video_url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, video_url: e.target.value }))}
                    placeholder="https://vimeo.com/123456789 ou https://youtube.com/watch?v=..."
                    required
                  />
                  {formData.video_url && !embedUrl && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      URL inválida. Use links do Vimeo ou YouTube.
                    </div>
                  )}
                </div>

                {/* Video Preview */}
                {embedUrl && (
                  <div className="rounded-lg overflow-hidden border bg-black">
                    <div className="aspect-video">
                      <iframe
                        src={embedUrl}
                        className="h-full w-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="servings">Duração</Label>
                  <Input
                    id="servings"
                    value={formData.servings}
                    onChange={(e) => setFormData((prev) => ({ ...prev, servings: e.target.value }))}
                    placeholder="Ex: 45 min"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ingredients">Descrição da Aula</Label>
                  <Textarea
                    id="ingredients"
                    value={formData.ingredients}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ingredients: e.target.value }))}
                    placeholder="Descreva o conteúdo desta aula..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Material de Apoio / Notas</Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData((prev) => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Notas, referências, materiais complementares..."
                    rows={6}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Thumbnail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {formData.image_url && thumbnailOptions.length === 0 ? (
                  <div className="relative">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, image_url: '' }));
                        setThumbnailOptions([]);
                        setSelectedThumbIndex(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : thumbnailOptions.length === 0 ? (
                  <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:bg-muted">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading || isFetchingThumb}
                    />
                    {isUploading || isFetchingThumb ? (
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
                ) : null}

                {/* Thumbnail options grid */}
                {thumbnailOptions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Escolha um frame do vídeo:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {thumbnailOptions.map((thumb, index) => (
                        <button
                          key={index}
                          type="button"
                          className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            selectedThumbIndex === index
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-transparent hover:border-muted-foreground/30'
                          } ${
                            thumbnailOptions.length === 5 && index === 4
                              ? 'col-span-2 max-w-[50%] mx-auto w-full'
                              : ''
                          }`}
                          onClick={() => handleSelectThumbnail(index)}
                        >
                          <img
                            src={thumb.url}
                            alt={`Frame em ${thumb.label}`}
                            className="aspect-video w-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                            {thumb.label}
                          </span>
                          {selectedThumbIndex === index && (
                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                              <div className="rounded-full bg-primary p-1">
                                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          asChild
                        >
                          <span>
                            <Upload className="mr-2 h-3 w-3" />
                            Upload manual
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                )}

                {detectPlatform(formData.video_url) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleFetchVideoThumb}
                    disabled={isFetchingThumb}
                  >
                    {isFetchingThumb ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Video className="mr-2 h-4 w-4" />
                    )}
                    {thumbnailOptions.length > 0
                      ? 'Buscar novos frames'
                      : `Buscar do ${detectPlatform(formData.video_url) === 'youtube' ? 'YouTube' : 'Vimeo'}`}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'draft' | 'published') =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicada</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Materiais de Acompanhamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {materials.map((mat, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg border p-2 bg-muted/50">
                    <File className="h-5 w-5 text-primary flex-shrink-0" />
                    <Input
                      value={mat.name}
                      onChange={(e) => handleMaterialNameChange(index, e.target.value)}
                      className="h-8 text-sm flex-1"
                      placeholder="Nome do material"
                    />
                    <a
                      href={mat.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 flex-shrink-0"
                    >
                      <FileDown className="h-4 w-4" />
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => handleRemoveMaterial(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-4 transition-colors hover:bg-muted">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
                    onChange={handleMaterialUpload}
                    className="hidden"
                    disabled={isUploadingMaterial}
                    multiple
                  />
                  {isUploadingMaterial ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <FileDown className="mb-1 h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground text-center">
                        {materials.length > 0 ? 'Adicionar mais materiais' : 'PDF, Word, PowerPoint, etc.'}
                      </span>
                    </>
                  )}
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Transcrição
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {detectPlatform(formData.video_url) === 'vimeo' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      setIsFetchingTranscript(true);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) throw new Error('Not authenticated');
                        const res = await supabase.functions.invoke('vimeo-transcript', {
                          body: { videoUrl: formData.video_url },
                        });
                        if (res.error) throw new Error(String(res.error));
                        const data = res.data as { transcript: string | null; language?: string; message?: string };
                        if (data.transcript) {
                          setFormData(prev => ({ ...prev, transcript: data.transcript! }));
                          toast.success(`Transcrição encontrada (${data.language || 'desconhecido'})`);
                        } else {
                          toast.info(data.message || 'Nenhuma transcrição encontrada');
                        }
                      } catch (err: any) {
                        console.error('Transcript fetch error:', err);
                        toast.error('Erro ao buscar transcrição do Vimeo');
                      } finally {
                        setIsFetchingTranscript(false);
                      }
                    }}
                    disabled={isFetchingTranscript}
                  >
                    {isFetchingTranscript ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Buscar Transcrição do Vimeo
                  </Button>
                )}
                <Textarea
                  value={formData.transcript}
                  onChange={(e) => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
                  placeholder="Transcrição do vídeo (busque do Vimeo ou cole manualmente)..."
                  rows={8}
                  className="text-xs"
                />
                {formData.transcript && (
                  <p className="text-xs text-muted-foreground">
                    {formData.transcript.length.toLocaleString()} caracteres
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Módulos</CardTitle>
              </CardHeader>
              <CardContent>
                {modules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum módulo cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {modules.map((mod) => (
                      <div key={mod.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`mod-${mod.id}`}
                          checked={selectedModules.includes(mod.id)}
                          onCheckedChange={() => toggleModule(mod.id)}
                        />
                        <Label htmlFor={`mod-${mod.id}`} className="cursor-pointer flex-1 truncate">
                          {mod.name}
                        </Label>
                        {selectedModules.includes(mod.id) && (
                          <Input
                            type="number"
                            min={0}
                            className="w-16 h-8 text-xs px-2"
                            placeholder="Ord."
                            value={moduleOrders[mod.id] ?? ''}
                            onChange={(e) =>
                              setModuleOrders((prev) => ({
                                ...prev,
                                [mod.id]: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/aulas')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createLesson.isPending || updateLesson.isPending}>
            {(createLesson.isPending || updateLesson.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditing ? 'Salvar Alterações' : 'Criar Aula'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LessonForm;
