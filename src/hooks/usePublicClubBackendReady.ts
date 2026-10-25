import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function usePublicClubBackendReady(enabled: boolean) {
  return useQuery({
    queryKey:['public-club-payment-version'],enabled,retry:false,staleTime:30000,refetchInterval:30000,
    queryFn:async()=>{
      const results=await Promise.all(['create-mp-payment','create-mp-subscription','club-guest-checkout'].map(name=>supabase.functions.invoke(name,{method:'GET'})));
      return results.every(result=>!result.error&&(result.data?.public_club_offer_version===2||result.data?.club_guest_checkout_version===2));
    },
  }).data===true;
}
