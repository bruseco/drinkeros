CREATE TABLE public.event_shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object' AND plan ? 'items' AND jsonb_typeof(plan->'items') = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_shopping_lists_owner ON public.event_shopping_lists(user_id, created_at DESC);
ALTER TABLE public.event_shopping_lists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_shopping_lists FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_shopping_lists TO authenticated;
GRANT ALL ON public.event_shopping_lists TO service_role;
CREATE POLICY "Owners read event shopping lists" ON public.event_shopping_lists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners create event shopping lists" ON public.event_shopping_lists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete event shopping lists" ON public.event_shopping_lists FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.event_shopping_checks (
  list_id uuid NOT NULL REFERENCES public.event_shopping_lists(id) ON DELETE CASCADE,
  item_index integer NOT NULL CHECK (item_index >= 0),
  is_checked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (list_id, item_index)
);
ALTER TABLE public.event_shopping_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_shopping_checks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shopping_checks TO authenticated;
GRANT ALL ON public.event_shopping_checks TO service_role;
CREATE POLICY "Owners manage event shopping checks" ON public.event_shopping_checks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.event_shopping_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.event_shopping_lists l WHERE l.id = list_id AND l.user_id = auth.uid()
    AND item_index < jsonb_array_length(l.plan->'items')));
