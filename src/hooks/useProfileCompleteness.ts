import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface ProfileCompleteness {
  missingCount: number;
  missingFields: string[];
  isComplete: boolean;
}

/**
 * Conta quantos campos do perfil estão faltando.
 * Considerados: avatar_url, full_name, phone, cpf, bio, birth_date, gender.
 */
export const useProfileCompleteness = (): ProfileCompleteness => {
  const { user, profile } = useAuth();
  const [extra, setExtra] = useState<{
    bio?: string | null;
    birth_date?: string | null;
    gender?: string | null;
    cpf?: string | null;
    phone?: string | null;
  }>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone, cpf, bio, birth_date, gender')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && data) setExtra(data as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const checks: { key: string; label: string; ok: boolean }[] = [
    { key: 'avatar', label: 'Foto', ok: !!profile?.avatar_url },
    { key: 'name', label: 'Nome', ok: !!(profile?.full_name && profile.full_name.trim()) },
    { key: 'phone', label: 'Telefone', ok: !!(extra.phone && extra.phone.trim()) },
    { key: 'cpf', label: 'CPF', ok: !!(extra.cpf && extra.cpf.replace(/\D/g, '').length === 11) },
    { key: 'bio', label: 'Sobre você', ok: !!(extra.bio && extra.bio.trim()) },
    { key: 'birth_date', label: 'Data de nascimento', ok: !!extra.birth_date },
    { key: 'gender', label: 'Sexo', ok: !!extra.gender },
  ];

  const missing = checks.filter((c) => !c.ok);
  return {
    missingCount: missing.length,
    missingFields: missing.map((m) => m.label),
    isComplete: missing.length === 0,
  };
};
