import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from './useUserPlan';

export type MyProductKind = 'course' | 'ebook' | 'exclusive';

export interface MyProduct {
  key: string;
  kind: MyProductKind;
  product_id: string;
  name: string;
  cover_image_url: string | null;
  purchased_at: string;
  /** Data de expiração original do registro (combo/curso/ebook). null = vitalício. */
  expires_at: string | null;
  is_lifetime: boolean;
  /**
   * Data efetiva de expiração considerando VIP/vitalício.
   * - vitalício → null
   * - VIP ativo → max(expires_at, vip_expires_at)
   * - sem VIP → expires_at
   */
  effective_expires_at: string | null;
  is_expired: boolean;
  /** Se a extensão foi feita pelo VIP (UI mostra badge VIP). */
  extended_by_vip: boolean;
}

const maxDate = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
};

export const useMyProducts = () => {
  const { user } = useAuth();
  const { data: planData } = useUserPlan();

  return useQuery<MyProduct[]>({
    queryKey: ['my-products', user?.id, planData?.expires_at, planData?.isVip],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const [{ data: lifetime }, { data: courses }, { data: ebooks }, { data: exclusives }] =
        await Promise.all([
          supabase.from('user_lifetime_access').select('id').eq('user_id', user.id).maybeSingle(),
          supabase
            .from('user_courses')
            .select('id, course_id, purchased_at, expires_at, course:courses(id, name, cover_image_url, is_active)')
            .eq('user_id', user.id),
          supabase
            .from('user_ebooks')
            .select('id, ebook_id, purchased_at, refunded_at, ebook:ebooks(id, name, cover_image_url, is_active)')
            .eq('user_id', user.id),
          supabase
            .from('user_exclusive_access')
            .select('id, feature, created_at, expires_at')
            .eq('user_id', user.id),
        ]);

      const isLifetime = !!lifetime;
      const vipActive = !!planData?.isVip;
      const vipExpiresAt = planData?.expires_at ?? null;
      const now = new Date();

      const buildProduct = (
        kind: MyProductKind,
        productId: string,
        name: string,
        cover: string | null,
        purchasedAt: string,
        expiresAt: string | null,
        keyId: string,
      ): MyProduct => {
        const lifetimeFinal = isLifetime;
        const baseExpires = lifetimeFinal ? null : expiresAt;
        const effective = lifetimeFinal
          ? null
          : vipActive
          ? maxDate(baseExpires, vipExpiresAt)
          : baseExpires;
        const expired = !lifetimeFinal && !!effective && new Date(effective) < now;
        const extendedByVip =
          !lifetimeFinal &&
          vipActive &&
          !!vipExpiresAt &&
          (!baseExpires || new Date(vipExpiresAt) > new Date(baseExpires));

        return {
          key: `${kind}-${keyId}`,
          kind,
          product_id: productId,
          name,
          cover_image_url: cover,
          purchased_at: purchasedAt,
          expires_at: baseExpires,
          is_lifetime: lifetimeFinal,
          effective_expires_at: effective,
          is_expired: expired,
          extended_by_vip: extendedByVip,
        };
      };

      const products: MyProduct[] = [];

      for (const uc of courses || []) {
        const c = uc.course as unknown as { id: string; name: string; cover_image_url: string | null; is_active: boolean } | null;
        if (!c) continue;
        products.push(buildProduct('course', c.id, c.name, c.cover_image_url, uc.purchased_at, uc.expires_at, uc.id));
      }

      // E-books são permanentes: nunca expiram; estornados não aparecem.
      for (const ue of ebooks || []) {
        if ((ue as { refunded_at?: string | null }).refunded_at) continue;
        const e = ue.ebook as unknown as { id: string; name: string; cover_image_url: string | null; is_active: boolean } | null;
        if (!e) continue;
        products.push({
          ...buildProduct('ebook', e.id, e.name, e.cover_image_url, ue.purchased_at, null, ue.id),
          expires_at: null,
          is_lifetime: true,
          effective_expires_at: null,
          is_expired: false,
          extended_by_vip: false,
        });
      }

      for (const ex of exclusives || []) {
        const featureName =
          ex.feature === 'receitas' ? 'Bebida Decifrada (Receitas Exclusivas)' : `Acesso Exclusivo: ${ex.feature}`;
        products.push(
          buildProduct('exclusive', ex.feature, featureName, null, ex.created_at, ex.expires_at, ex.id),
        );
      }

      // Ordena: ativos primeiro (vitalício, depois com mais tempo), expirados por último
      products.sort((a, b) => {
        if (a.is_expired !== b.is_expired) return a.is_expired ? 1 : -1;
        if (a.is_lifetime !== b.is_lifetime) return a.is_lifetime ? -1 : 1;
        const ae = a.effective_expires_at ? new Date(a.effective_expires_at).getTime() : Infinity;
        const be = b.effective_expires_at ? new Date(b.effective_expires_at).getTime() : Infinity;
        return be - ae;
      });

      return products;
    },
  });
};
