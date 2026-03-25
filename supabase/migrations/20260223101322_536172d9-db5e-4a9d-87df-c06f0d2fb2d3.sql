
-- Create ux_interactions table for tracking user behavior
CREATE TABLE public.ux_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX idx_ux_interactions_user_id ON public.ux_interactions(user_id);
CREATE INDEX idx_ux_interactions_event_type ON public.ux_interactions(event_type);

-- Enable RLS
ALTER TABLE public.ux_interactions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own ux events"
ON public.ux_interactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can read own events (for session count check)
CREATE POLICY "Users can view own ux events"
ON public.ux_interactions
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can read all events
CREATE POLICY "Admins can view all ux events"
ON public.ux_interactions
FOR SELECT
USING (is_admin(auth.uid()));
