import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
type FavoriteDatabase = { public: Omit<Database['public'], 'Functions'> & { Functions: Database['public']['Functions'] & {
  save_favorite_to_list: { Args: { p_recipe_id: string; p_collection_id?: string; p_collection_name?: string }; Returns: string };
  delete_favorite_list: { Args: { p_collection_id: string }; Returns: undefined };
} } };
export const favoriteLists = supabase as unknown as SupabaseClient<FavoriteDatabase>;
