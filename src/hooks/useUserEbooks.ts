import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Regra de negócio: e-books NUNCA expiram por tempo.
 * Só um estorno real (refunded_at preenchido) revoga o acesso.
 */
export interface UserEbookAccess {
  ebook_id: string;
  expires_at: null;
  is_expired: false;
  effective_expires_at: null;
}

interface EbookRow {
  ebook_id: string;
  refunded_at: string | null;
}

/** IDs de e-books ativos (não estornados). Função pura, testável. */
export const activeEbookIds = (rows: EbookRow[]): string[] =>
  rows.filter((r) => !r.refunded_at).map((r) => r.ebook_id);

/** Converte registros em acessos permanentes, ocultando estornados. */
export const toEbookAccess = (rows: EbookRow[]): UserEbookAccess[] =>
  activeEbookIds(rows).map((ebook_id) => ({
    ebook_id,
    expires_at: null,
    is_expired: false,
    effective_expires_at: null,
  }));

const fetchRows = async (userId: string): Promise<EbookRow[]> => {
  const { data, error } = await supabase
    .from('user_ebooks')
    .select('ebook_id, refunded_at')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []) as EbookRow[];
};

/** Retorna apenas os IDs (mantém compat com chamadas existentes). */
export const useUserEbooks = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-ebooks', user?.id],
    queryFn: async () => activeEbookIds(await fetchRows(user!.id)),
    enabled: !!user?.id,
  });
};

/** Detalhes de acesso de cada e-book — sempre permanentes. */
export const useUserEbooksWithExpiry = () => {
  const { user } = useAuth();
  return useQuery<UserEbookAccess[]>({
    queryKey: ['user-ebooks-expiry', user?.id],
    queryFn: async () => toEbookAccess(await fetchRows(user!.id)),
    enabled: !!user?.id,
  });
};
