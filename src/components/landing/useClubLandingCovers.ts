import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import bindings from './clubCoverBindings.json';

type CoverRow = {recipe_id:string;cover_image_url:string};
export function useClubLandingCovers<T extends {recipes:Array<{title:string;image:string}>}>(categories:T[]):T[] {
  const {data=[]}=useQuery({
    queryKey:['club-landing-live-covers'],
    queryFn:async()=>{
      const {data,error}=await supabase.rpc('get_club_landing_covers' as any);
      if(error)throw error;
      return (data??[]) as unknown as CoverRow[];
    },
    staleTime:30_000,
    refetchInterval:60_000,
    retry:1,
  });
  return useMemo(()=>{
    const covers=new Map(data.filter(row=>/^https?:\/\//.test(row.cover_image_url)).map(row=>[row.recipe_id,row.cover_image_url]));
    return categories.map(category=>({...category,recipes:category.recipes.map(recipe=>{
      const id=bindings[recipe.title as keyof typeof bindings];
      return {...recipe,image:covers.get(id)??recipe.image};
    })}));
  },[categories,data]);
}
