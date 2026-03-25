
-- Create certificates table
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  certificate_type text NOT NULL,
  reference_id uuid NOT NULL,
  reference_name text NOT NULL,
  verification_code text NOT NULL UNIQUE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_certificates_unique ON public.certificates (user_id, certificate_type, reference_id);

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Users can view their own certificates
CREATE POLICY "Users can view own certificates"
ON public.certificates
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own certificates
CREATE POLICY "Users can insert own certificates"
ON public.certificates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all certificates
CREATE POLICY "Admins can view all certificates"
ON public.certificates
FOR SELECT
USING (public.is_admin(auth.uid()));
