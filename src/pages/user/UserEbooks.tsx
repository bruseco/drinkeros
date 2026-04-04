import React from 'react';
import { useEbooks } from '@/hooks/useEbooks';
import { useUserEbooks } from '@/hooks/useUserEbooks';
import { Loader2, FileText, Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const UserEbooks: React.FC = () => {
  const { data: ebooks = [], isLoading } = useEbooks();
  const { data: userEbookIds = [], isLoading: userLoading } = useUserEbooks();
  const activeEbooks = ebooks.filter(e => e.is_active);
  const ownedSet = new Set(userEbookIds);

  if (isLoading || userLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">E-books</h1>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">E-books</h1>

      {activeEbooks.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum e-book disponível no momento</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1">
          {activeEbooks.map((ebook) => {
            const owned = ownedSet.has(ebook.id);
            return (
              <div key={ebook.id} className="relative">
                {/* Badge */}
                <div className="absolute top-3 right-3 z-10">
                  {owned ? (
                    <Badge className="bg-success text-success-foreground border-0 shadow-md text-xs">
                      ✓ Adquirido
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted/60 text-muted-foreground border-0 shadow-md text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Bloqueado
                    </Badge>
                  )}
                </div>

                {/* Cover */}
                <div className={`overflow-hidden rounded-2xl shadow-md ${!owned ? 'opacity-50 grayscale-[30%]' : ''}`}>
                  {ebook.cover_image_url ? (
                    <img
                      src={ebook.cover_image_url}
                      alt={ebook.name}
                      className="w-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-52 bg-muted flex items-center justify-center">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Title + Download */}
                <div className="mt-3 space-y-2">
                  <h3 className="font-semibold text-foreground text-lg">{ebook.name}</h3>
                  {owned && ebook.file_url ? (
                    <Button asChild size="sm" className="w-full">
                      <a href={ebook.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Baixar E-book
                      </a>
                    </Button>
                  ) : !owned ? (
                    <Button size="sm" variant="secondary" className="w-full" disabled>
                      <Lock className="mr-2 h-4 w-4" />
                      E-book Bloqueado
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserEbooks;
