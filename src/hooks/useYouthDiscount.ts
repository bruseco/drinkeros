import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Desconto "Jovem Bartender": usuários com 24 anos ou menos
 * pagam R$27 no anual do Clube (em vez de R$47).
 *
 * Frase: "Condição especial para estudantes e jovens bartenders em início de carreira."
 *
 * A elegibilidade é validada também no servidor (edge functions
 * create-mp-payment / create-mp-subscription) lendo profiles.birth_date,
 * para que o cliente não consiga falsificar o preço.
 */
export const YOUTH_MAX_AGE = 24;
export const YOUTH_PRICE = 27;

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export interface YouthDiscountState {
  isYouth: boolean;
  age: number | null;
  price: number;
  loading: boolean;
}

export function useYouthDiscount(): YouthDiscountState {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{ birth_date: string | null } | null>({
    queryKey: ['youth-birth-date', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('birth_date')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  const age = calcAge(data?.birth_date ?? null);
  const isYouth = age !== null && age <= YOUTH_MAX_AGE && age >= 14;

  return {
    isYouth,
    age,
    price: isYouth ? YOUTH_PRICE : 47,
    loading: isLoading,
  };
}
