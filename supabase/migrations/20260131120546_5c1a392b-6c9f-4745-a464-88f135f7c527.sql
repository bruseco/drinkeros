-- Add slug column to packages table
ALTER TABLE public.packages 
ADD COLUMN slug text UNIQUE;

-- Update existing packages with slugs based on name
UPDATE public.packages 
SET slug = lower(regexp_replace(
  regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
  '\s+', '-', 'g'
));

-- Make slug required after populating
ALTER TABLE public.packages 
ALTER COLUMN slug SET NOT NULL;