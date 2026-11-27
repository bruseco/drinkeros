-- Exclude both the RAND combo and the instructor's standalone course.
-- Preserve all other offers, existing VIP conditions and function permissions.
CREATE OR REPLACE FUNCTION public.black80_price(_type text,_slug text,_base numeric,_current numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN NOT public.black80_active() OR _slug IN ('rand','classicos-destilados') THEN _current
 WHEN _type='club' AND _slug='clube-anual' THEN least(_current,47)
 WHEN _type IN ('course','ebook','combo','package') AND _base>0 THEN least(_current,round(_base*0.2,2))
 ELSE _current END;
$$;
