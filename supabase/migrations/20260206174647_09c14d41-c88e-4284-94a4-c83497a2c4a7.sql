
-- Create study_reminder_settings table
CREATE TABLE public.study_reminder_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inactive_days integer NOT NULL DEFAULT 7,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_reminder_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read
CREATE POLICY "Super admins can view study reminder settings"
ON public.study_reminder_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Only super_admins can update
CREATE POLICY "Super admins can update study reminder settings"
ON public.study_reminder_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Insert default row
INSERT INTO public.study_reminder_settings (inactive_days, is_enabled) VALUES (7, true);

-- Add trigger for updated_at
CREATE TRIGGER update_study_reminder_settings_updated_at
BEFORE UPDATE ON public.study_reminder_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
