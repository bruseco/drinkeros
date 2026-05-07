import { useEffect } from 'react';
import { trackFbEvent } from '@/lib/metaPixel';

/**
 * Dispara Meta Pixel ViewContent uma única vez por chave.
 * Use em páginas-chave (receita, curso, e-book, pacote, venda, Clube).
 */
export function useViewContent(params: {
  key: string | undefined | null;
  content_name?: string | null;
  content_category?: string | null;
  content_type?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
}) {
  const { key, content_name, content_category, content_type, content_ids, value, currency } = params;

  useEffect(() => {
    if (!key || !content_name) return;
    trackFbEvent(
      'ViewContent',
      {
        content_name,
        content_category,
        ...(content_type ? { content_type } : {}),
        ...(content_ids ? { content_ids } : {}),
        ...(value !== undefined ? { value } : {}),
        ...(currency ? { currency } : {}),
      },
      { dedupeKey: `${content_category || 'page'}:${key}` }
    );
  }, [key, content_name, content_category, content_type, JSON.stringify(content_ids || []), value, currency]);
}
