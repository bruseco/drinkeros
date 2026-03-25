
ALTER TABLE public.onboarding_reminder_settings
ADD COLUMN second_reminder_days integer NOT NULL DEFAULT 7,
ADD COLUMN second_reminder_enabled boolean NOT NULL DEFAULT true;
