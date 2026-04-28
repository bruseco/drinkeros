import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const REPORT_KEY = 'pwa-status-reported';

/** Detecta se o app está rodando como PWA instalado (standalone) */
export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia('(display-mode: standalone)').matches;
  const fullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const minimalUi = window.matchMedia('(display-mode: minimal-ui)').matches;
  // iOS Safari
  // @ts-ignore
  const iosStandalone = (window.navigator as any).standalone === true;
  return mql || fullscreen || minimalUi || iosStandalone;
}

interface PwaStatus {
  /** A sessão atual está rodando dentro do PWA instalado */
  isStandalone: boolean;
  /** O usuário já abriu o app via PWA pelo menos uma vez (detectado em qualquer device/sessão) */
  hasInstalledBefore: boolean | null;
  /** Última vez que abriu via PWA */
  lastPwaOpenAt: string | null;
  loading: boolean;
}

export function usePwaStatus(): PwaStatus {
  const { user } = useAuth();
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [hasInstalledBefore, setHasInstalledBefore] = useState<boolean | null>(null);
  const [lastPwaOpenAt, setLastPwaOpenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Atualiza standalone se mudar (ex: instalou e abriu na mesma sessão)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = () => setIsStandalone(detectStandalone());
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Carrega status do perfil
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('pwa_installed_at, last_pwa_open_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setHasInstalledBefore(!!data?.pwa_installed_at);
      setLastPwaOpenAt(data?.last_pwa_open_at ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Reporta abertura via PWA (1x por sessão)
  useEffect(() => {
    if (!user || !isStandalone) return;
    if (sessionStorage.getItem(REPORT_KEY)) return;
    sessionStorage.setItem(REPORT_KEY, '1');

    (async () => {
      const now = new Date().toISOString();
      // Só seta pwa_installed_at se ainda não tiver
      const { data: prof } = await supabase
        .from('profiles')
        .select('pwa_installed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const update: Record<string, string> = { last_pwa_open_at: now };
      if (!prof?.pwa_installed_at) update.pwa_installed_at = now;

      await supabase.from('profiles').update(update).eq('user_id', user.id);
      setHasInstalledBefore(true);
      setLastPwaOpenAt(now);
    })();
  }, [user, isStandalone]);

  return { isStandalone, hasInstalledBefore, lastPwaOpenAt, loading };
}
