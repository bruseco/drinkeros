import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import logoUrl from '@/assets/criminal-logo-white.png';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRecipe } from '@/hooks/useRecipes';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites, useToggleFavorite } from '@/hooks/useUserData';
import { useTrackRecipeView, useToggleLessonComplete } from '@/hooks/useRecipeViews';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Heart,
  Loader2,
  FileText,
  Clock,
  Play,
  CheckCircle2,
  Circle,
  Download,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

const UserLesson: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { data: lesson, isLoading } = useRecipe(id || '');
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const trackLessonView = useTrackRecipeView();
  const toggleComplete = useToggleLessonComplete();

  const isFavorite = favorites.some((f) => f.recipe_id === id);

  // Fetch module lessons (lessons in same package as current lesson)
  const { data: moduleLessons = [] } = useQuery({
    queryKey: ['module-lessons', id],
    queryFn: async () => {
      if (!id) return [];
      
      // First get the package(s) this lesson belongs to
      const { data: lessonPackages } = await supabase
        .from('recipe_packages')
        .select('package_id')
        .eq('recipe_id', id);

      if (!lessonPackages || lessonPackages.length === 0) return [];

      const packageId = lessonPackages[0].package_id;

      // Get package info
      const { data: packageInfo } = await supabase
        .from('packages')
        .select('id, name')
        .eq('id', packageId)
        .single();

      // Get all lessons in this package
      const { data: packageLessons } = await supabase
        .from('recipe_packages')
        .select(`
          display_order,
          recipe:recipes (
            id,
            name,
            image_url,
            servings,
            status
          )
        `)
        .eq('package_id', packageId)
        .order('display_order', { ascending: true });

      return {
        packageName: packageInfo?.name || 'Módulo',
        lessons: packageLessons
          ?.filter(pl => pl.recipe && pl.recipe.status === 'published')
          .map(pl => ({
            id: pl.recipe!.id,
            name: pl.recipe!.name,
            image_url: pl.recipe!.image_url,
            duration: pl.recipe!.servings,
            display_order: pl.display_order,
          })) || [],
      };
    },
    enabled: !!id,
  });

  // Get completed lessons (only those explicitly marked as completed)
  const { data: viewedLessons = [] } = useQuery({
    queryKey: ['viewed-lessons'],
    queryFn: async () => {
      const { data } = await supabase
        .from('recipe_views')
        .select('recipe_id')
        .eq('completed', true);
      return data?.map(v => v.recipe_id) || [];
    },
  });

  // Fetch materials for this lesson
  const { data: lessonMaterials = [] } = useQuery({
    queryKey: ['lesson-materials', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from('recipe_materials')
        .select('id, name, file_url')
        .eq('recipe_id', id)
        .order('display_order');
      return data || [];
    },
    enabled: !!id,
  });

  // Track lesson view when loaded
  useEffect(() => {
    if (lesson?.id) {
      trackLessonView.mutate(lesson.id);
    }
  }, [lesson?.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Aula não encontrada</p>
      </div>
    );
  }

  const getVideoEmbedUrl = (url: string) => {
    // Vimeo (supports private/unlisted URLs with hash: vimeo.com/ID/HASH)
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (vimeoMatch) {
      const hash = vimeoMatch[2];
      const hashParam = hash ? `&h=${hash}` : '';
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0${hashParam}`;
    }
    // YouTube
    const ytRegExp = /^.*(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11}).*/;
    const ytMatch = url.match(ytRegExp);
    if (ytMatch) {
      return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?modestbranding=1&rel=0&iv_load_policy=3&showinfo=0`;
    }
    return url;
  };

  const lessonsData = moduleLessons as { packageName: string; lessons: any[] } | [];
  const packageName = Array.isArray(lessonsData) ? 'Módulo' : lessonsData.packageName;
  const lessons = Array.isArray(lessonsData) ? [] : lessonsData.lessons;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            if (location.key !== 'default') {
              navigate(-1);
            } else {
              navigate('/app');
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-lg font-bold line-clamp-1">{lesson.name}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleFavorite.mutate({ recipeId: lesson.id, isFavorite })}
        >
          <Heart
            className={cn('h-5 w-5', isFavorite && 'fill-destructive text-destructive')}
          />
        </Button>
      </div>

      {/* Main Content - Video + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Video and Info */}
        <div className="flex-1 min-w-0">
          {/* Video Player */}
          {lesson.video_url ? (
            <Card className="mb-4 overflow-hidden rounded-xl border-0 shadow-lg">
              <div className="aspect-video bg-black">
                <iframe
                  src={getVideoEmbedUrl(lesson.video_url)}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </Card>
          ) : lesson.image_url ? (
            <div className="mb-4 overflow-hidden rounded-xl">
              <img
                src={lesson.image_url}
                alt={lesson.name}
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : null}

          {/* Duration and Complete Button */}
          <div className="mb-4 flex items-center justify-between">
            {lesson.servings && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="h-4 w-4" />
                <span>Duração: {lesson.servings}</span>
              </div>
            )}
            
            {/* Mark Complete Button */}
            {(() => {
              const isCompleted = viewedLessons.includes(lesson.id);
              return (
                <Button
                  variant={isCompleted ? "outline" : "default"}
                  size="sm"
                  onClick={() => toggleComplete.mutate({ lessonId: lesson.id, isCompleted })}
                  disabled={toggleComplete.isPending}
                  className={cn(
                    "gap-2 transition-all",
                    isCompleted && "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                  )}
                >
                  {toggleComplete.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  {isCompleted ? 'Concluída' : 'Marcar como Concluída'}
                </Button>
              );
            })()}
          </div>

          {/* Description */}
          {lesson.ingredients && (
            <Card className="mb-4 rounded-xl border-muted/20">
              <CardContent className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <FileText className="h-4 w-4 text-primary" />
                  Descrição da Aula
                </h2>
                <div className="whitespace-pre-line text-muted-foreground text-sm leading-relaxed">
                  {lesson.ingredients}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo da Aula */}
          {lesson.instructions && (
            <Card className="mb-4 rounded-xl border-muted/20">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <FileText className="h-4 w-4 text-primary" />
                    Resumo da Aula
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-primary/30 hover:bg-primary/10 flex-shrink-0"
                    onClick={async () => {
                      const studentName = profile?.full_name || user?.email || 'Aluno';
                      const studentEmail = profile?.email || user?.email || '';

                      // Load logo as base64 via canvas (compatível com jsPDF independente do formato)
                      let logoBase64: string | null = null;
                      try {
                        logoBase64 = await new Promise<string>((resolve, reject) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            const ctx = canvas.getContext('2d')!;
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                          };
                          img.onerror = reject;
                          img.src = logoUrl;
                        });
                      } catch {
                        logoBase64 = null;
                      }

                      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
                      const pageWidth = doc.internal.pageSize.getWidth();
                      const pageHeight = doc.internal.pageSize.getHeight();
                      const margin = 15;
                      const contentWidth = pageWidth - margin * 2;
                      let y = margin;

                      // Watermark helper
                      const addWatermark = () => {
                        const cx = pageWidth / 2;
                        const cy = pageHeight / 2;
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(11);
                        doc.setTextColor(210, 210, 210);
                        const wmText = `${studentName} · ${studentEmail}`;
                        doc.text(wmText, cx, cy, { angle: 45, align: 'center' });
                        doc.setTextColor(0, 0, 0);
                      };

                      // Header
                      doc.setFillColor(15, 15, 15);
                      doc.rect(0, 0, pageWidth, 20, 'F');

                      // Logo ou fallback text
                      if (logoBase64) {
                        // Logo com texto branco diretamente sobre o header preto — sem fundo extra
                        doc.addImage(logoBase64, 'PNG', margin, 3, 54, 14);
                      } else {
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        doc.text('Criminal Lab', margin, 13);
                      }

                      doc.setTextColor(255, 255, 255);
                      doc.setFontSize(8);
                      doc.setFont('helvetica', 'normal');
                      doc.text('Resumo da Aula', pageWidth - margin, 13, { align: 'right' });

                      y = 30;
                      doc.setTextColor(0, 0, 0);
                      doc.setFontSize(14);
                      doc.setFont('helvetica', 'bold');
                      const titleLines = doc.splitTextToSize(lesson.name, contentWidth);
                      doc.text(titleLines, margin, y);
                      y += titleLines.length * 7 + 4;

                      // Divider
                      doc.setDrawColor(200, 200, 200);
                      doc.line(margin, y, pageWidth - margin, y);
                      y += 8;

                      // Watermark on first page
                      addWatermark();

                      // Parse markdown line by line
                      const rawLines = (lesson.instructions || '').split('\n');

                      const addNewPage = () => {
                        doc.addPage();
                        addWatermark();
                        y = margin;
                      };

                      const checkPageBreak = (needed: number) => {
                        if (y + needed > pageHeight - 20) addNewPage();
                      };

                      for (const rawLine of rawLines) {
                        const trimmed = rawLine.trim();

                        // Skip horizontal rules
                        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
                          checkPageBreak(6);
                          doc.setDrawColor(220, 220, 220);
                          doc.line(margin, y, pageWidth - margin, y);
                          y += 6;
                          continue;
                        }

                        // H2 heading
                        if (trimmed.startsWith('## ')) {
                          const text = trimmed.replace(/^##\s+/, '').replace(/\*\*/g, '');
                          checkPageBreak(12);
                          y += 4;
                          doc.setFontSize(11);
                          doc.setFont('helvetica', 'bold');
                          doc.setTextColor(15, 15, 15);
                          const wrapped = doc.splitTextToSize(text, contentWidth);
                          doc.text(wrapped, margin, y);
                          y += wrapped.length * 6 + 2;
                          continue;
                        }

                        // H3 heading
                        if (trimmed.startsWith('### ')) {
                          const text = trimmed.replace(/^###\s+/, '').replace(/\*\*/g, '');
                          checkPageBreak(10);
                          y += 2;
                          doc.setFontSize(10);
                          doc.setFont('helvetica', 'bold');
                          doc.setTextColor(30, 30, 30);
                          const wrapped = doc.splitTextToSize(text, contentWidth);
                          doc.text(wrapped, margin, y);
                          y += wrapped.length * 5.5 + 1;
                          continue;
                        }

                        // Bullet list
                        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                          const text = '• ' + trimmed.slice(2).replace(/\*\*/g, '');
                          checkPageBreak(6);
                          doc.setFontSize(9);
                          doc.setFont('helvetica', 'normal');
                          doc.setTextColor(40, 40, 40);
                          const wrapped = doc.splitTextToSize(text, contentWidth - 5);
                          doc.text(wrapped, margin + 4, y);
                          y += wrapped.length * 5 + 1;
                          continue;
                        }

                        // Empty line
                        if (trimmed === '') {
                          y += 2;
                          continue;
                        }

                        // Regular paragraph — strip bold markers
                        const text = trimmed.replace(/\*\*/g, '');
                        checkPageBreak(6);
                        doc.setFontSize(9);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(40, 40, 40);
                        const wrapped = doc.splitTextToSize(text, contentWidth);
                        doc.text(wrapped, margin, y);
                        y += wrapped.length * 5 + 1;
                      }

                      // Footer on all pages
                      const totalPages = doc.getNumberOfPages();
                      for (let p = 1; p <= totalPages; p++) {
                        doc.setPage(p);
                        doc.setFontSize(7);
                        doc.setTextColor(150, 150, 150);
                        doc.text(
                          'Resumo gerado automaticamente pelo Criminal Lab',
                          pageWidth / 2,
                          pageHeight - 8,
                          { align: 'center' }
                        );
                        doc.text(
                          `Página ${p} de ${totalPages}`,
                          pageWidth - margin,
                          pageHeight - 8,
                          { align: 'right' }
                        );
                      }

                      const fileName = lesson.name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
                      doc.save(`Resumo_${fileName}.pdf`);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Baixar PDF
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none text-sm text-foreground [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-3 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>p]:leading-relaxed [&>p]:text-muted-foreground [&>strong]:text-foreground [&>hr]:border-muted">
                  <ReactMarkdown>{lesson.instructions}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Downloadable Materials */}
          {lessonMaterials.length > 0 && (
            <Card className="rounded-xl border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <Download className="h-4 w-4 text-primary" />
                  {lessonMaterials.length === 1 ? 'Material de Acompanhamento' : 'Materiais de Acompanhamento'}
                </h2>
                <div className="space-y-2">
                  {lessonMaterials.map((mat) => (
                    <a
                      key={mat.id}
                      href={mat.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Button variant="outline" className="gap-2 w-full justify-start border-primary/30 hover:bg-primary/10">
                        <File className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{mat.name}</span>
                        <Download className="h-3 w-3 ml-auto flex-shrink-0" />
                      </Button>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Fallback for legacy material_url */}
          {lessonMaterials.length === 0 && lesson.material_url && (
            <Card className="rounded-xl border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <Download className="h-4 w-4 text-primary" />
                  Material de Acompanhamento
                </h2>
                <a
                  href={lesson.material_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Button variant="outline" className="gap-2 w-full sm:w-auto border-primary/30 hover:bg-primary/10">
                    <Download className="h-4 w-4" />
                    Baixar Material
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Module Lessons List */}
        {lessons.length > 0 && (
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <Card className="rounded-xl border-muted/20 sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{packageName}</CardTitle>
                {(() => {
                  const watchedInModule = lessons.filter(l => viewedLessons.includes(l.id)).length;
                  const progressPercent = lessons.length > 0 ? (watchedInModule / lessons.length) * 100 : 0;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {watchedInModule} de {lessons.length} aulas assistidas
                        </span>
                        <span className="font-medium text-primary">
                          {Math.round(progressPercent)}%
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-1.5" />
                    </div>
                  );
                })()}
              </CardHeader>
              <ScrollArea className="h-[calc(100vh-260px)] max-h-[560px]">
                <div className="px-4 pb-4 space-y-2">
                  {lessons.map((l, index) => {
                    const isCurrentLesson = l.id === id;
                    const isViewed = viewedLessons.includes(l.id);

                    return (
                      <Link
                        key={l.id}
                        to={`/app/aula/${l.id}`}
                        className={cn(
                          'flex gap-3 p-2 rounded-lg transition-colors group',
                          isCurrentLesson
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-24 h-14 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                          {l.image_url ? (
                            <img
                              src={l.image_url}
                              alt={l.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                              <Play className="h-5 w-5 text-primary/60" />
                            </div>
                          )}
                          {isCurrentLesson && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-muted-foreground font-medium">
                              {index + 1}.
                            </span>
                            <h3
                              className={cn(
                                'text-sm font-medium line-clamp-2 leading-tight',
                                isCurrentLesson && 'text-primary'
                              )}
                            >
                              {l.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {l.duration && (
                              <span className="text-xs text-muted-foreground">
                                {l.duration}
                              </span>
                            )}
                            {isViewed && !isCurrentLesson && (
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserLesson;
