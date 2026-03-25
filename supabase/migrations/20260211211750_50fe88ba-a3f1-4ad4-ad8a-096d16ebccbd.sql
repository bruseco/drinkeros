
-- Table to store redirect links with UTM tracking
CREATE TABLE public.redirect_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  source text NOT NULL DEFAULT 'plataforma',
  product_name text,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_clicked_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.redirect_links ENABLE ROW LEVEL SECURITY;

-- Public read for redirect to work (no auth needed)
CREATE POLICY "Anyone can read redirect links"
ON public.redirect_links
FOR SELECT
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage redirect links"
ON public.redirect_links
FOR ALL
USING (public.is_admin(auth.uid()));

-- Function to increment click count (callable without auth via service role in edge functions)
CREATE OR REPLACE FUNCTION public.increment_redirect_click(link_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE redirect_links
  SET click_count = click_count + 1,
      last_clicked_at = now()
  WHERE code = link_code;
END;
$$;
