import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { black80Active, black80Price, type Black80Campaign } from '../../supabase/functions/_shared/black80';
export function useBlack80() {
  const query = useQuery({queryKey:['black80-campaign'],queryFn:async()=>{
    const {data,error}=await supabase.rpc('public_black80_campaign' as never);
    if(error)throw error;
    return {campaign:(data as unknown as Black80Campaign[])?.[0],receivedAt:Date.now()};
  },refetchInterval:30000,staleTime:10000,retry:1});
  const campaign=query.data?.campaign;
  const now=campaign?.server_now ? Date.parse(campaign.server_now)+Date.now()-query.data!.receivedAt : Date.now();
  return {active:!query.isError && black80Active(campaign,now),loading:query.isLoading,
    price:(type:string,slug:string,base:number,current=base)=>black80Price(type,slug,base,current,query.isError?null:campaign,now)};
}
