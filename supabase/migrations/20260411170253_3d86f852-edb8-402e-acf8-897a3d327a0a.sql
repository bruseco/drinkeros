-- Table to manage exclusive content access (e.g. recipes)
CREATE TABLE public.user_exclusive_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL DEFAULT 'receitas',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);

ALTER TABLE public.user_exclusive_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exclusive access"
  ON public.user_exclusive_access
  FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own exclusive access"
  ON public.user_exclusive_access
  FOR SELECT
  USING (auth.uid() = user_id);

-- Helper function
CREATE OR REPLACE FUNCTION public.has_exclusive_access(_user_id uuid, _feature text DEFAULT 'receitas')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_exclusive_access
    WHERE user_id = _user_id
      AND feature = _feature
  )
  OR public.is_admin(_user_id)
$$;