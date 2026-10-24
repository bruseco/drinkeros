import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';
import type { ShoppingPlan } from '@/lib/shoppingPlan';

export type EventShoppingList = { id: string; user_id: string; name: string; plan: ShoppingPlan; created_at: string };
type Check = { list_id: string; item_index: number; is_checked: boolean };
type EventDatabase = { public: Omit<Database['public'], 'Tables'> & { Tables: Database['public']['Tables'] & {
  event_shopping_lists: { Row: EventShoppingList; Insert: { user_id: string; name: string; plan: ShoppingPlan }; Update: never; Relationships: [] };
  event_shopping_checks: { Row: Check; Insert: Check; Update: { is_checked: boolean }; Relationships: [] };
} } };
const db = supabase as unknown as SupabaseClient<EventDatabase>;

export function useEventShoppingLists() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['event-shopping-lists', user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from('event_shopping_lists').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error; return data ?? [];
    } });
}
export function useCreateEventShoppingList() {
  const { user } = useAuth(), client = useQueryClient();
  return useMutation({ mutationFn: async (plan: ShoppingPlan) => {
    if (!user) throw new Error('Entre na sua conta para salvar a lista.');
    const { data, error } = await db.from('event_shopping_lists').insert({ user_id: user.id, name: plan.name, plan }).select('*').single();
    if (error) throw error; return data;
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['event-shopping-lists', user?.id] }) });
}
export function useEventShoppingChecks(listId: string | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['event-shopping-checks', user?.id, listId], enabled: !!user && !!listId,
    queryFn: async () => {
      const { data, error } = await db.from('event_shopping_checks').select('*').eq('list_id', listId!);
      if (error) throw error; return data ?? [];
    } });
}
export function useSetEventShoppingCheck(listId: string | null) {
  const { user } = useAuth(), client = useQueryClient();
  return useMutation({ mutationFn: async ({ index, checked }: { index: number; checked: boolean }) => {
    if (!user || !listId) throw new Error('Lista não disponível.');
    const { error } = await db.from('event_shopping_checks').upsert({ list_id: listId, item_index: index, is_checked: checked }, { onConflict: 'list_id,item_index' });
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['event-shopping-checks', user?.id, listId] }) });
}
export function useDeleteEventShoppingList() {
  const { user } = useAuth(), client = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => {
    if (!user) throw new Error('Entre na sua conta para excluir a lista.');
    const { error } = await db.from('event_shopping_lists').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  }, onSuccess: async (_, id) => {
    client.removeQueries({ queryKey: ['event-shopping-checks', user?.id, id] });
    await client.invalidateQueries({ queryKey: ['event-shopping-lists', user?.id] });
  } });
}
