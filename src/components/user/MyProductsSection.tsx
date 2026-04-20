import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GraduationCap, BookOpen, Sparkles, Calendar, Infinity as InfinityIcon, Crown, AlertCircle, Loader2 } from 'lucide-react';
import { useMyProducts, type MyProduct } from '@/hooks/useMyProducts';
import defaultCover from '@/assets/default-cover.png';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<MyProduct['kind'], React.ComponentType<{ className?: string }>> = {
  course: GraduationCap,
  ebook: BookOpen,
  exclusive: Sparkles,
};

const KIND_LABEL: Record<MyProduct['kind'], string> = {
  course: 'Curso',
  ebook: 'E-book',
  exclusive: 'Acesso exclusivo',
};

const ProductRow: React.FC<{ p: MyProduct }> = ({ p }) => {
  const Icon = KIND_ICON[p.kind];
  const expired = p.is_expired;

  const expiryLabel = (() => {
    if (p.is_lifetime) return null;
    if (!p.effective_expires_at) return null;
    return format(new Date(p.effective_expires_at), "dd/MM/yyyy", { locale: ptBR });
  })();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
        {p.cover_image_url ? (
          <img
            src={p.cover_image_url || defaultCover}
            alt={p.name}
            className={cn('h-full w-full object-cover', expired && 'opacity-50 grayscale')}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-tight', expired ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {p.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {KIND_LABEL[p.kind]}
          </span>

          {p.is_lifetime ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-600 dark:text-amber-400 font-medium">
              <InfinityIcon className="h-3 w-3" />
              Acesso vitalício
            </span>
          ) : expired ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive font-medium">
              <AlertCircle className="h-3 w-3" />
              Expirado em {expiryLabel}
            </span>
          ) : p.extended_by_vip ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 px-2 py-0.5 text-purple-600 dark:text-purple-300 font-medium">
              <Crown className="h-3 w-3" />
              Ativo via VIP até {expiryLabel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <Calendar className="h-3 w-3" />
              Expira em {expiryLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const MyProductsSection: React.FC = () => {
  const { data: products = [], isLoading } = useMyProducts();

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Você ainda não possui produtos adquiridos.
      </div>
    );
  }

  const hasExpired = products.some((p) => p.is_expired);

  return (
    <div className="space-y-2 p-3">
      {hasExpired && (
        <Link
          to="/vip"
          className="block rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-500 p-3 text-white shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 flex-shrink-0" />
            <p className="text-xs leading-tight">
              <strong>Reative seus produtos expirados</strong> com a assinatura VIP.
            </p>
          </div>
        </Link>
      )}
      {products.map((p) => (
        <ProductRow key={p.key} p={p} />
      ))}
    </div>
  );
};
