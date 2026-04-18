
-- Tabela de planos do usuário
CREATE TABLE public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'vip')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan"
  ON public.user_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all plans"
  ON public.user_plans FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_plans_user_id ON public.user_plans(user_id);
CREATE INDEX idx_user_plans_expires_at ON public.user_plans(expires_at);

-- Tabela de contagem diária de visualizações (plano Grátis)
CREATE TABLE public.daily_recipe_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_id, view_date)
);

ALTER TABLE public.daily_recipe_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily views"
  ON public.daily_recipe_views FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all daily views"
  ON public.daily_recipe_views FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_daily_views_user_date ON public.daily_recipe_views(user_id, view_date);

-- Função: retorna plano efetivo do usuário (admins sempre são tratados como VIP)
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin(_user_id) THEN 'vip'
    WHEN EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = _user_id
        AND plan = 'vip'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'vip'
    ELSE 'free'
  END;
$$;

-- Função: conta visualizações de hoje
CREATE OR REPLACE FUNCTION public.count_daily_views(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.daily_recipe_views
  WHERE user_id = _user_id
    AND view_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

-- Atualizar handle_new_user para criar plano free automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

    INSERT INTO public.user_plans (user_id, plan)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Inserir plano free para usuários existentes
INSERT INTO public.user_plans (user_id, plan)
SELECT user_id, 'free' FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
