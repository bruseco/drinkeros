import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Egg, Loader2, GraduationCap } from 'lucide-react';
import { InstallBanner } from '@/components/user/InstallBanner';
import { usePackageBySlug } from '@/hooks/usePackages';
import { useCourseBySlug, useCoursePackages } from '@/hooks/useCourses';

const PackageLanding: React.FC = () => {
  const { packageSlug } = useParams<{ packageSlug: string }>();
  const { data: pkg, isLoading: pkgLoading, error: pkgError } = usePackageBySlug(packageSlug || '');
  const { data: course, isLoading: courseLoading, error: courseError } = useCourseBySlug(packageSlug || '');
  const { data: courseModules = [] } = useCoursePackages(course?.id || '');

  const isLoading = pkgLoading || courseLoading;
  const item = pkg || course;
  const isCourse = !pkg && !!course;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If neither package nor course found, redirect to 404
  if (!item) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-background dark:to-orange-950/20 flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Logo / Icon */}
          <div className="mb-8 inline-flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full blur-2xl opacity-30 animate-pulse" />
              {item.cover_image_url ? (
                <div className="relative w-28 h-28 rounded-full shadow-2xl overflow-hidden">
                  <img 
                    src={item.cover_image_url} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-6 rounded-full shadow-2xl">
                  <Egg className="h-16 w-16 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Badge for course */}
          {isCourse && (
            <div className="mb-4">
              <Badge className="bg-primary/80 text-primary-foreground text-sm px-4 py-1">
                Curso · {courseModules.length} módulos
              </Badge>
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              {item.name}
            </span>
          </h1>

          {/* Subtitle */}
          {item.description && (
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-md mx-auto">
              {item.description}
            </p>
          )}

          {/* Course modules list */}
          {isCourse && courseModules.length > 0 && (
            <div className="mb-8 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Módulos inclusos
              </h3>
              <div className="space-y-2">
                {courseModules.map((cp) => (
                  <div key={cp.id} className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-3 text-left">
                    {cp.package?.cover_image_url ? (
                      <img src={cp.package.cover_image_url} alt={cp.package.name} className="h-8 w-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{cp.package?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Install Banner */}
          <div className="mb-8 max-w-md mx-auto">
            <InstallBanner />
          </div>

          {/* Login Button */}
          <Button 
            size="lg" 
            asChild
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-6 text-lg font-semibold"
          >
            <Link to="/login">
              Iniciar
            </Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {item.name}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default PackageLanding;
