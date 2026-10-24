import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPublicClubOffer, type PublicClubOffer } from '@/lib/publicClubOffer';
import type { ClubeIntroOfferState } from './useClubeIntroOffer';
export function usePublicClubeOffer(enabled: boolean): ClubeIntroOfferState {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const startedVisit=useRef(false);
  const key = ['public-club-offer',user?.id ?? 'visitor'];
  const query = useQuery({ queryKey:key,queryFn:async()=>{
    const newVisit=!startedVisit.current;
    const row=await fetchPublicClubOffer(false,newVisit);
    startedVisit.current=true;
    return {row,receivedAt:Date.now()};
  },enabled:enabled&&!authLoading,staleTime:0,refetchOnMount:'always',refetchOnWindowFocus:true });
  const [now,setNow] = useState(Date.now());
  const deadline = query.data?.row.expires_at ? new Date(query.data.row.expires_at).getTime() : 0;
  const offset = query.data ? new Date(query.data.row.server_now).getTime()-query.data.receivedAt : 0;
  const localDeadline = deadline ? deadline-offset : 0;
  useEffect(()=>{if(!enabled||!localDeadline)return;const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer)},[enabled,localDeadline]);
  const row = query.data?.row;
  const active = !!row && (!row.revealed_at || localDeadline>now);
  return { isLoading:enabled&&(authLoading||query.isLoading),isActive:active,eligibleUntilMs:localDeadline,
    hasRevealed:!!row?.revealed_at,price:active&&row?.revealed_at?Number(row.price):197,promoPrice:97,fullPrice:197,
    markRevealed:async()=>{const next:PublicClubOffer=await fetchPublicClubOffer(true);queryClient.setQueryData(key,{row:next,receivedAt:Date.now()});setNow(Date.now())} };
}
