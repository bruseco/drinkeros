import React from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Package, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PackageOption {
  id: string;
  name: string;
  cover_image_url: string | null;
}

interface PackageFilterProps {
  packages: PackageOption[];
  selectedPackageId: string | null;
  onSelectPackage: (packageId: string | null) => void;
}

export const PackageFilter: React.FC<PackageFilterProps> = ({
  packages,
  selectedPackageId,
  onSelectPackage,
}) => {
  if (packages.length <= 1) return null;

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Button
          variant={selectedPackageId === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelectPackage(null)}
          className={cn(
            'shrink-0 gap-2 rounded-full',
            selectedPackageId === null && 'bg-primary text-primary-foreground'
          )}
        >
          <Grid3X3 className="h-4 w-4" />
          Todas
        </Button>
        
        {packages.map((pkg) => (
          <Button
            key={pkg.id}
            variant={selectedPackageId === pkg.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectPackage(pkg.id)}
            className={cn(
              'shrink-0 gap-2 rounded-full',
              selectedPackageId === pkg.id && 'bg-primary text-primary-foreground'
            )}
          >
            {pkg.cover_image_url ? (
              <img
                src={pkg.cover_image_url}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <Package className="h-4 w-4" />
            )}
            <span className="max-w-[120px] truncate">{pkg.name}</span>
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="invisible" />
    </ScrollArea>
  );
};
