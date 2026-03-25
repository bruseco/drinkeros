-- Create recipe_views table to track which recipes users have viewed
CREATE TABLE public.recipe_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index para busca rapida por usuario
CREATE INDEX idx_recipe_views_user_id ON public.recipe_views(user_id);

-- Index para busca por receita
CREATE INDEX idx_recipe_views_recipe_id ON public.recipe_views(recipe_id);

-- Index composto para evitar duplicatas (unique constraint)
CREATE UNIQUE INDEX idx_recipe_views_user_recipe ON public.recipe_views(user_id, recipe_id);

-- Enable RLS
ALTER TABLE public.recipe_views ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios so podem ver suas proprias visualizacoes
CREATE POLICY "Users can view own recipe views"
  ON public.recipe_views FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: usuarios podem inserir suas proprias visualizacoes
CREATE POLICY "Users can insert own recipe views"
  ON public.recipe_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: usuarios podem atualizar suas proprias visualizacoes (para upsert do viewed_at)
CREATE POLICY "Users can update own recipe views"
  ON public.recipe_views FOR UPDATE
  USING (auth.uid() = user_id);