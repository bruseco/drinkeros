import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useCombo, useComboCourses, useUserCombos } from '@/hooks/useCombos';
import { useExpiredAccess } from '@/hooks/useExpiredAccess';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookOpen, Play, ChevronRight, Lock, ShoppingCart, Crown } from 'lucide-react';

const UserComboDetail: React.FC = () => {
  const { comboId } = useParams<{ comboId: string }>();
  const [searchParams] = useSearchParams();
  const isLockedParam = searchParams.get('locked') === 'true';

  const { data: combo, isLoading: comboLoading } = useCombo(comboId || '');
  const { data: comboCourses = [], isLoading: coursesLoading } = useComboCourses(comboId || '');
  const { data: userCombos = [] } = useUserCombos();
  const { data: expiredAccess } = useExpiredAccess();

  const isExpired = !!comboId && (expiredAccess?.combo_ids?.has(comboId) ?? false);
  const isEnrolled = userCombos.some(uc => uc.combo_id === comboId);
  const isLocked = isLockedParam || !isEnrolled || isExpired;

  const isLoading = comboLoading || coursesLoading;

  const checkoutUrl = combo?.hotmart_product_code || null;

  const handleCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!combo) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Combo não encontrado</p>
          <Link to="/app/combos">
            <Button variant="link" className="mt-2">Voltar aos combos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/combos">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{combo.name}</h1>
          <p className="text-sm text-muted-foreground">
            {comboCourses.length} {comboCourses.length === 1 ? 'curso' : 'cursos'}
          </p>
        </div>
      </div>

      {/* CTA: VIP quando expirado, checkout normal quando bloqueado */}
      {isExpired ? (
        <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-500 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base">Acesso expirado</h3>
                <p className="text-white/90 text-sm">Reative todos os seus produtos com o VIP</p>
              </div>
            </div>
            <Button asChild className="bg-white text-purple-700 hover:bg-white/90 font-bold gap-2 rounded-xl shadow-md">
              <Link to="/vip">
                <Crown className="h-4 w-4" />
                Virar VIP
              </Link>
            </Button>
          </div>
        </div>
      ) : isLocked && checkoutUrl && (
        <div className="rounded-2xl bg-gradient-to-r from-primary/90 to-accent/80 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base">Desbloqueie este combo</h3>
                <p className="text-white/80 text-sm">Tenha acesso a todos os cursos inclusos</p>
              </div>
            </div>
            <Button
              onClick={handleCheckout}
              className="bg-white text-primary hover:bg-white/90 font-bold gap-2 rounded-xl shadow-md"
            >
              <ShoppingCart className="h-4 w-4" />
              Matricule-se
            </Button>
          </div>
        </div>
      )}

      {/* Cover image */}
      <div className="relative overflow-hidden rounded-2xl aspect-[21/9]">
        <img
          src={combo.cover_image_url || defaultCover}
          alt={combo.name}
          className={`w-full h-full object-cover ${isLocked ? 'opacity-60 grayscale-[20%]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60 border border-white/20">
              <Lock className="h-7 w-7 text-white/80" />
            </div>
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <h2 className="text-white text-2xl font-bold drop-shadow-lg">{combo.name}</h2>
          {combo.description && <p className="text-white/80 text-sm mt-1 line-clamp-2">{combo.description}</p>}
        </div>
      </div>

      {comboCourses.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Este combo ainda não tem cursos</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {comboCourses.map((cc) => {
            const course = cc.course;
            if (!course) return null;

            if (isLocked) {
              return (
                <div key={cc.id} onClick={handleCheckout} className="cursor-pointer">
                  <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
                    <img
                      src={course.cover_image_url || defaultCover}
                      alt={course.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-50 grayscale-[30%]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 border border-white/20">
                        <Lock className="h-6 w-6 text-white/80" />
                      </div>
                    </div>
                    <div className="relative h-full flex flex-col justify-end p-4">
                      <Badge variant="secondary" className="bg-muted/60 text-muted-foreground border-0 shadow-md text-xs w-fit gap-1 mb-1">
                        <Lock className="h-3 w-3" />
                        Bloqueado
                      </Badge>
                      <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">{course.name}</h3>
                      <div className="flex items-center gap-1 text-white/80 text-xs mt-1">
                        <span>Desbloquear</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Card>
                </div>
              );
            }

            return (
              <Link key={cc.id} to={`/app/curso/${course.id}`}>
                <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
                  <img src={course.cover_image_url || defaultCover} alt={course.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg">
                      <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                  <div className="relative h-full flex flex-col justify-end p-4">
                    <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">{course.name}</h3>
                    <div className="flex items-center gap-1 text-white/80 text-xs mt-1">
                      <span>Ver módulos</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserComboDetail;
