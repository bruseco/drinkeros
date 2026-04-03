import React from 'react';
import { useEbooks } from '@/hooks/useEbooks';
import { Loader2, FileText, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const UserEbooks: React.FC = () => {
  const { data: ebooks = [], isLoading } = useEbooks();
  const activeEbooks = ebooks.filter(e => e.is_active);

  if (isLoading) {
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
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">E-books</h1>
        <p className="text-muted-foreground">{activeEbooks.length} e-books disponíveis</p>
      </div>

      {activeEbooks.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-muted p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum e-book disponível no momento</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {activeEbooks.map((ebook) => (
            <Card key={ebook.id} className="overflow-hidden">
              {ebook.cover_image_url ? (
                <img
                  src={ebook.cover_image_url}
                  alt={ebook.name}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-muted flex items-center justify-center">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-foreground line-clamp-2">{ebook.name}</h3>
                {ebook.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{ebook.description}</p>
                )}
                {ebook.file_url && (
                  <Button asChild size="sm" className="w-full">
                    <a href={ebook.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Baixar E-book
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserEbooks;
