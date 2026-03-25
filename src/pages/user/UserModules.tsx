import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useUserPackages } from '@/hooks/useUserData';
import { usePackages } from '@/hooks/usePackages';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, GraduationCap, Sparkles, ChevronRight, Play } from 'lucide-react';
import { UpsellCardCompact } from '@/components/user/UpsellCardCompact';

const UserModules: React.FC = () => {
  const { data: userPackages = [], isLoading } = useUserPackages();
  const { data: allPackages = [] } = usePackages(true);

  const userPackageIds = userPackages.map((up) => up.package_id);
  const upsellPackages = allPackages.filter(
    (p) => !userPackageIds.includes(p.id) && !p.is_free && p.is_available_for_sale && !!p.hotmart_product_code
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-10">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-bold text-foreground mb-2">Meus Módulos</h1>
        <p className="text-muted-foreground">Gerencie seus cursos e módulos</p>
      </section>

      {/* User's modules */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-primary">📚</span>
          Módulos Adquiridos ({userPackages.length})
        </h2>
        {userPackages.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">Você ainda não tem módulos</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {userPackages.map((up) => (
              <OwnedModuleCard key={up.id} pkg={up.package} packageId={up.package.id} />
            ))}
          </div>
        )}
      </section>

      {/* Upsell modules */}
      {upsellPackages.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Descubra Mais
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {upsellPackages.map((pkg) => (
              <UpsellCardCompact key={pkg.id} pkg={pkg} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

interface OwnedModuleCardProps {
  pkg: {
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
  };
  packageId: string;
}

const OwnedModuleCard: React.FC<OwnedModuleCardProps> = ({ pkg, packageId }) => {
  return (
    <Link to={`/app/modulo/${packageId}`}>
      <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
        <img
          src={pkg.cover_image_url || defaultCover}
          alt={pkg.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg">
            <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
          </div>
        </div>
        
        {/* Content */}
        <div className="relative h-full flex flex-col justify-between p-4">
          <div className="flex justify-end">
            <Badge className="bg-success text-success-foreground border-0 shadow-md text-xs">
              ✓ Adquirido
            </Badge>
          </div>
          
          <div className="space-y-1">
            <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">
              {pkg.name}
            </h3>
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <span>Ver aulas</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default UserModules;
