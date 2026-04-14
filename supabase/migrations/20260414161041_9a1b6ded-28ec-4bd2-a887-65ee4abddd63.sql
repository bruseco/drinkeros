ALTER TABLE public.courses
  ADD COLUMN certificate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN certificate_bg_url text;