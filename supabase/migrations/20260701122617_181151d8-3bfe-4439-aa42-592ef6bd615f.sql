-- Abre o Clube dos Drinkeros para qualquer usuário autenticado
CREATE OR REPLACE FUNCTION public.is_club_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL;
$$;