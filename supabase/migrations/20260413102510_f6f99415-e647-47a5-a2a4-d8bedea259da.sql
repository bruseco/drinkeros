ALTER TABLE public.combos 
  ADD COLUMN is_lifetime boolean NOT NULL DEFAULT false,
  ADD COLUMN includes_exclusive_access boolean NOT NULL DEFAULT false;