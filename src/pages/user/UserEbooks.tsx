import React from 'react';
import { Link } from 'react-router-dom';
import { useEbooks } from '@/hooks/useEbooks';
import { useUserEbooks } from '@/hooks/useUserEbooks';
import { useExpiredAccess } from '@/hooks/useExpiredAccess';
import { Loader2, FileText, Download, Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const UserEbooks: React.FC = () => {
  const { data: ebooks = [], isLoading } = useEbooks();
  const { data: userEbookIds = [], isLoading: userLoading } = useUserEbooks();
  const { data: expiredAccess } = useExpiredAccess();
  const ownedSet = new Set(userEbookIds);
  const expiredSet = expiredAccess?.ebook_ids ?? new Set<string>();

  const activeEbooks = ebooks
    .filter(e => e.is_active)
    .sort((a, b) => {
      const aOwned = ownedSet.has(a.id);
      const bOwned = ownedSet.has(b.id);
      if (aOwned !== bOwned) return aOwned ? -1 : 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });

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
        <div className="grid gap-8 grid-cols-1">
          {activeEbooks.map((ebook) => {
            const owned = ownedSet.has(ebook.id);
            const expired = expiredSet.has(ebook.id);

            // Define a ação única do card
            const canDownload = owned && !expired && !!ebook.file_url;
            const cardHref = canDownload
              ? ebook.file_url!
              : `/ebook/${ebook.slug}`;
            const isExternal = canDownload;

            const cardInner = (
              <>
                <div className="relative w-full">
                  {ebook.cover_image_url ? (
                    <div className={`w-full rounded-2xl overflow-hidden flex items-center justify-center ${expired ? 'opacity-40 grayscale' : !owned ? 'opacity-60 grayscale-[30%]' : ''}`}>
                      <img
                        src={ebook.cover_image_url}
                        alt={ebook.name}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl bg-muted flex items-center justify-center aspect-square">
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-[22%] right-[52px] z-10">
                    {expired ? (
                      <Badge className="bg-destructive text-destructive-foreground border-0 shadow-md text-xs gap-1">
                        <Crown className="h-3 w-3" />
                        Expirado
                      </Badge>
                    ) : owned ? (
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
                </div>

                <h3
                  className="font-bold text-foreground text-base text-center -mt-5 relative z-10"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)' }}
                >
                  {ebook.name}
                </h3>

                <div className="mt-2 pointer-events-none">
                  {expired ? (
                    <Button size="sm" className="bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 text-white">
                      <Crown className="mr-2 h-4 w-4" />
                      Renovar no Clube
                    </Button>
                  ) : canDownload ? (
                    <Button size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Abrir e-book
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary">Saiba Mais</Button>
                  )}
                </div>
              </>
            );

            const wrapperClass =
              'flex flex-col items-center w-full max-w-[390px] mx-auto cursor-pointer transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl';

            // Para expirados, sempre vai para o /clube
            if (expired) {
              return (
                <Link key={ebook.id} to="/clube" className={wrapperClass} aria-label={`${ebook.name} — Renovar no Clube`}>
                  {cardInner}
                </Link>
              );
            }

            if (isExternal) {
              return (
                <a
                  key={ebook.id}
                  href={cardHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={wrapperClass}
                  aria-label={`Abrir e-book ${ebook.name}`}
                >
                  {cardInner}
                </a>
              );
            }

            return (
              <Link
                key={ebook.id}
                to={cardHref}
                className={wrapperClass}
                aria-label={`Saiba mais sobre ${ebook.name}`}
              >
                {cardInner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserEbooks;
