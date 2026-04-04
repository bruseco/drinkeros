CREATE OR REPLACE FUNCTION public.search_exclusive_posts(
  p_term text,
  p_published_only boolean DEFAULT false,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  youtube_url text,
  cover_image_url text,
  is_published boolean,
  display_order integer,
  ingredients text[],
  instructions text,
  characteristics text[],
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT ep.*
    FROM exclusive_posts ep
    WHERE (NOT p_published_only OR ep.is_published = true)
      AND (
        p_term IS NULL OR p_term = '' OR
        ep.title ILIKE '%' || p_term || '%' OR
        ep.instructions ILIKE '%' || p_term || '%' OR
        EXISTS (SELECT 1 FROM unnest(ep.ingredients) AS ing WHERE ing ILIKE '%' || p_term || '%') OR
        EXISTS (SELECT 1 FROM unnest(ep.characteristics) AS ch WHERE ch ILIKE '%' || p_term || '%')
      )
  ),
  cnt AS (SELECT count(*) AS total FROM filtered)
  SELECT 
    f.id, f.title, f.description, f.youtube_url, f.cover_image_url,
    f.is_published, f.display_order, f.ingredients, f.instructions,
    f.characteristics, f.created_at, f.updated_at,
    cnt.total AS total_count
  FROM filtered f, cnt
  ORDER BY f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;