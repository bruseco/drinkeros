
CREATE OR REPLACE FUNCTION public.search_exclusive_posts(
  p_term text,
  p_published_only boolean DEFAULT false,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, title text, description text, youtube_url text, cover_image_url text,
  is_published boolean, display_order integer, ingredients text[], instructions text,
  characteristics text[], created_at timestamp with time zone, updated_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_term text;
  v_tokens text[];
BEGIN
  v_term := lower(public.unaccent(coalesce(p_term, '')));
  -- split em tokens >=2 chars, descartando vazios
  v_tokens := ARRAY(
    SELECT t FROM unnest(regexp_split_to_array(v_term, '\s+')) AS t
    WHERE length(t) >= 2
  );

  RETURN QUERY
  WITH filtered AS (
    SELECT ep.*
    FROM exclusive_posts ep
    WHERE (NOT p_published_only OR ep.is_published = true)
      AND (
        coalesce(array_length(v_tokens, 1), 0) = 0
        OR (
          -- TODOS os tokens precisam bater em algum dos campos
          SELECT bool_and(
            lower(public.unaccent(ep.title)) ILIKE '%' || tok || '%'
            OR lower(public.unaccent(coalesce(ep.instructions, ''))) ILIKE '%' || tok || '%'
            OR EXISTS (SELECT 1 FROM unnest(ep.ingredients) AS ing WHERE lower(public.unaccent(ing)) ILIKE '%' || tok || '%')
            OR EXISTS (SELECT 1 FROM unnest(ep.characteristics) AS ch WHERE lower(public.unaccent(ch)) ILIKE '%' || tok || '%')
          )
          FROM unnest(v_tokens) AS tok
        )
      )
  ),
  cnt AS (SELECT count(*) AS total FROM filtered)
  SELECT
    f.id, f.title, f.description, f.youtube_url, f.cover_image_url,
    f.is_published, f.display_order, f.ingredients, f.instructions,
    f.characteristics, f.created_at, f.updated_at,
    cnt.total AS total_count
  FROM filtered f, cnt
  ORDER BY
    -- prioriza match no título
    CASE WHEN lower(public.unaccent(f.title)) ILIKE '%' || v_term || '%' THEN 0 ELSE 1 END,
    f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
