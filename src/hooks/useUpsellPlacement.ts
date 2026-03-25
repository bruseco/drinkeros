import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SESSION_CACHE_KEY = 'ux_upsell_position';

interface UpsellPlacementResult {
  position: number;
  isLoading: boolean;
}

export const useUpsellPlacement = (totalCarousels: number): UpsellPlacementResult => {
  const { user } = useAuth();
  const [position, setPosition] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || fetchedRef.current) {
      setIsLoading(false);
      return;
    }

    // Check session cache first
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      setPosition(parsed.position);
      setIsLoading(false);
      fetchedRef.current = true;
      return;
    }

    const fetchPlacement = async () => {
      try {
        // Count user's past sessions
        const { count } = await supabase
          .from('ux_interactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('event_type', 'session_start');

        const sessionCount = count || 0;
        const maxPos = Math.max(totalCarousels, 2);

        if (sessionCount < 5) {
          // Not enough data — random position (1 to maxPos)
          const randomPos = Math.floor(Math.random() * maxPos) + 1;
          const pos = Math.min(randomPos, maxPos);
          setPosition(pos);
          sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ position: pos }));
        } else {
          // Fetch recent interactions for the agent
          const { data: interactions } = await supabase
            .from('ux_interactions')
            .select('event_type, metadata, created_at')
            .eq('user_id', user.id)
            .in('event_type', ['upsell_view', 'upsell_click', 'scroll_depth'])
            .order('created_at', { ascending: false })
            .limit(50);

          const { data: fnData, error: fnError } = await supabase.functions.invoke('ux-placement-agent', {
            body: {
              user_id: user.id,
              total_carousels: totalCarousels,
              recent_interactions: interactions || [],
            },
          });

          if (fnError || !fnData?.position) {
            // Fallback to random
            const randomPos = Math.floor(Math.random() * maxPos) + 1;
            setPosition(Math.min(randomPos, maxPos));
          } else {
            setPosition(Math.min(fnData.position, maxPos));
          }

          sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ position }));
        }

        // Log session start
        await supabase.from('ux_interactions').insert({
          user_id: user.id,
          event_type: 'session_start',
          metadata: { total_carousels: totalCarousels },
        });
      } catch (err) {
        console.error('useUpsellPlacement error:', err);
        // Fallback
        const randomPos = Math.floor(Math.random() * Math.max(totalCarousels, 2)) + 1;
        setPosition(randomPos);
      } finally {
        setIsLoading(false);
        fetchedRef.current = true;
      }
    };

    fetchPlacement();
  }, [user?.id, totalCarousels]);

  return { position, isLoading };
};
