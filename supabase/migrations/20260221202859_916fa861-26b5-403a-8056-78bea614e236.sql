-- Add duration field to recipes (lessons) for automatic workload calculation
ALTER TABLE public.recipes ADD COLUMN duration_seconds integer DEFAULT 0;