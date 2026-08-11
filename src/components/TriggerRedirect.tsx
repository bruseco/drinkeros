import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Component that handles ?trigger=HASH redirects.
 * Looks up the hash in redirect_links and redirects to destination_url.
 * Returns true if a redirect is in progress, false otherwise.
 */
export function useTriggerRedirect(): boolean {
  const [searchParams] = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const trigger = searchParams.get('trigger');
    if (!trigger) return;

    setIsRedirecting(true);

    (async () => {
      try {
        const { data } = await supabase.rpc('resolve_redirect_link', { link_code: trigger });

        const destination = typeof data === 'string' ? data : null;
        if (destination) {
          // Increment click count (fire and forget)
          supabase.rpc('increment_redirect_click', { link_code: trigger }).then(() => {});
          window.location.href = destination;
        } else {
          // Invalid code, stop redirecting
          setIsRedirecting(false);
        }
      } catch {
        setIsRedirecting(false);
      }
    })();

  }, [searchParams]);

  return isRedirecting;
}
