import React from 'react';
import defaultCover from '@/assets/default-cover.png';
import { Link } from 'react-router-dom';
import { useUserCombos } from '@/hooks/useCombos';
import { useCombos } from '@/hooks/useCombos';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Layers, ChevronRight, Play, Sparkles } from 'lucide-react';
import { UpsellCardCompact } from '@/components/user/UpsellCardCompact';

const UserCombos: React.FC = () => {
  const { data: userCombos = [], isLoading } = useUserCombos();
  const { data: allCombos = [] } = useCombos(true);

  const userComboIds = userCombos.map((uc) => uc.combo_id);
  const upsellCombos = allCombos.filter(
    (c) => !userComboIds.includes(c.id) && !c.is_free && c.is_available_for_sale && !!c.checkout_url
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
      <section>
        <h1 className="text-2xl font-bold text-foreground mb-2">Meus Combos</h1>
        <p className="text-muted-foreground">Seus combos e formações completas</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-primary">🎯</span>
          Combos Adquiridos ({userCombos.length})
        </h2>
        {userCombos.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-muted p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">Você ainda não tem combos</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {userCombos.map((uc) => (
              <Link key={uc.id} to={`/app/combo/${uc.combo_id}`}>
                <Card className="group overflow-hidden rounded-2xl border-0 bg-card shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 aspect-video relative">
                  <img
                    src={uc.combo.cover_image_url || defaultCover}
                    alt={uc.combo.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 shadow-lg">
                      <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                  <div className="relative h-full flex flex-col justify-between p-4">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-primary/80 text-primary-foreground border-0 shadow-md text-xs">
                        {uc.courses.length} {uc.courses.length === 1 ? 'curso' : 'cursos'}
                      </Badge>
                      <Badge className="bg-success text-success-foreground border-0 shadow-md text-xs">
                        ✓ Adquirido
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-white text-base line-clamp-2 drop-shadow-md">{uc.combo.name}</h3>
                      <div className="flex items-center gap-1 text-white/80 text-xs">
                        <span>Ver cursos</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {upsellCombos.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Descubra Mais
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {upsellCombos.map((combo) => (
              <UpsellCardCompact
                key={combo.id}
                pkg={{
                  id: combo.id,
                  name: combo.name,
                  description: combo.description,
                  cover_image_url: combo.cover_image_url,
                  checkout_url: combo.checkout_url,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default UserCombos;
