import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, ExternalLink, Sparkles } from 'lucide-react';
import defaultCover from '@/assets/default-cover.png';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

export interface UpsellCardCompactProps {
  pkg: {
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    checkout_url: string | null;
  };
}

export const UpsellCardCompact: React.FC<UpsellCardCompactProps> = ({ pkg }) => {
  const baseCheckoutUrl = pkg.checkout_url || null;
  
  // Append UTM params for platform tracking
  const checkoutUrl = baseCheckoutUrl
    ? (() => {
        const separator = baseCheckoutUrl.includes('?') ? '&' : '?';
        const utms = `utm_source=plataforma&utm_medium=upsell_card&utm_campaign=${encodeURIComponent(pkg.name)}`;
        return `${baseCheckoutUrl}${separator}${utms}`;
      })()
    : null;
  return (
    <Card className="overflow-hidden rounded-2xl border-0 shadow-md flex flex-col h-full group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Image Area */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={pkg.cover_image_url || defaultCover}
          alt={pkg.name}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Badge over image */}
        <div className="absolute top-2 right-2">
          <Badge className="bg-accent text-accent-foreground border-0 shadow-md gap-1">
            <Sparkles className="h-3 w-3" />
            Novo
          </Badge>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-2.5 flex flex-col flex-1 space-y-3 bg-card">
        <h3 className="font-semibold text-foreground text-sm line-clamp-3 leading-snug min-h-[3.5rem]">
          {pkg.name}
        </h3>
        
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg transition-all duration-300 group-hover:scale-105"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Matricule-se agora
            </Button>
          </a>
        ) : (
          <Button
            size="sm"
            className="w-full"
            variant="secondary"
            disabled
          >
            Em breve
          </Button>
        )}
      </div>
    </Card>
  );
};

export const UpsellCardCompactSkeleton: React.FC = () => {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 shadow-md aspect-[4/3]">
      <Skeleton className="h-full w-full" />
    </Card>
  );
};

// Upsell Section with header - for inline display between carousels
export interface UpsellSectionProps {
  packages: Array<{
    id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    checkout_url: string | null;
  }>;
}

export const UpsellSection: React.FC<UpsellSectionProps> = ({ packages }) => {
  if (packages.length === 0) return null;

  return (
    <section className="space-y-4 pt-2">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="font-semibold text-lg text-foreground">Talvez você se interesse</h2>
      </div>

      <div className="relative -mx-4 px-4 overflow-visible">
        <Carousel
          opts={{
            align: 'start',
            dragFree: true,
            containScroll: 'trimSnaps',
          }}
          className="w-full overflow-visible"
        >
          <CarouselContent className="-ml-2 md:-ml-3 overflow-visible">
            {packages.map((pkg) => (
              <CarouselItem
                key={pkg.id}
                className="pl-2 md:pl-3 basis-[65%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
              >
                <UpsellCardCompact pkg={pkg} />
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious className="hidden md:flex -left-3 h-10 w-10 border-0 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background" />
          <CarouselNext className="hidden md:flex -right-3 h-10 w-10 border-0 bg-background/90 shadow-lg backdrop-blur-sm hover:bg-background" />
        </Carousel>
      </div>
    </section>
  );
};
