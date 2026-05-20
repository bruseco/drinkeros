CREATE INDEX IF NOT EXISTS idx_recipe_views_user_viewed_at ON public.recipe_views (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ux_interactions_created_at ON public.ux_interactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ux_interactions_user_event ON public.ux_interactions (user_id, event_type);