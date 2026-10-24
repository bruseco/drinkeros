-- Preserve legacy ungrouped favorites, with a real editable collection per account.
DO $$
DECLARE u record; v_collection uuid;
BEGIN
  FOR u IN SELECT f.user_id, min(f.created_at) AS first_saved FROM public.favorites f
    WHERE NOT EXISTS (SELECT 1 FROM public.collection_recipes cr JOIN public.collections c ON c.id=cr.collection_id
      WHERE c.user_id=f.user_id AND cr.recipe_id=f.recipe_id) GROUP BY f.user_id
  LOOP
    SELECT id INTO v_collection FROM public.collections WHERE user_id=u.user_id AND name='Sem lista' ORDER BY created_at LIMIT 1;
    IF v_collection IS NULL THEN
      INSERT INTO public.collections(user_id,name,created_at) VALUES(u.user_id,'Sem lista',coalesce(u.first_saved,now())) RETURNING id INTO v_collection;
    END IF;
    INSERT INTO public.collection_recipes(collection_id,recipe_id,created_at)
      SELECT v_collection,f.recipe_id,coalesce(f.created_at,now()) FROM public.favorites f WHERE f.user_id=u.user_id
      AND NOT EXISTS (SELECT 1 FROM public.collection_recipes cr JOIN public.collections c ON c.id=cr.collection_id WHERE c.user_id=u.user_id AND cr.recipe_id=f.recipe_id);
  END LOOP;
END $$;

CREATE FUNCTION public.save_favorite_to_list(p_recipe_id uuid,p_collection_id uuid DEFAULT NULL,p_collection_name text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_collection uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  IF p_recipe_id IS NULL THEN RAISE EXCEPTION 'Receita inválida.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('favorite-list:' || v_user::text,0));
  IF p_collection_id IS NOT NULL THEN
    SELECT id INTO v_collection FROM public.collections WHERE id=p_collection_id AND user_id=v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lista não encontrada.'; END IF;
  ELSE
    IF p_collection_name IS NULL OR length(trim(p_collection_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Escolha ou crie uma lista.'; END IF;
    SELECT id INTO v_collection FROM public.collections WHERE user_id=v_user AND name=trim(p_collection_name) ORDER BY created_at LIMIT 1;
    IF v_collection IS NULL AND trim(p_collection_name)='Aulas Favoritas' THEN
      SELECT id INTO v_collection FROM public.collections WHERE user_id=v_user AND name IN ('Aulas','Cursos') ORDER BY created_at LIMIT 1;
      IF v_collection IS NOT NULL THEN UPDATE public.collections SET name='Aulas Favoritas' WHERE id=v_collection; END IF;
    END IF;
    IF v_collection IS NULL THEN INSERT INTO public.collections(user_id,name) VALUES(v_user,trim(p_collection_name)) RETURNING id INTO v_collection; END IF;
  END IF;
  INSERT INTO public.favorites(user_id,recipe_id) SELECT v_user,p_recipe_id
    WHERE NOT EXISTS(SELECT 1 FROM public.favorites WHERE user_id=v_user AND recipe_id=p_recipe_id);
  INSERT INTO public.collection_recipes(collection_id,recipe_id) SELECT v_collection,p_recipe_id
    WHERE NOT EXISTS(SELECT 1 FROM public.collection_recipes WHERE collection_id=v_collection AND recipe_id=p_recipe_id);
  RETURN v_collection;
END $$;
REVOKE ALL ON FUNCTION public.save_favorite_to_list(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_favorite_to_list(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.delete_favorite_list(p_collection_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_user uuid := auth.uid(); v_recipes uuid[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('favorite-list:' || v_user::text,0));
  PERFORM 1 FROM public.collections WHERE id=p_collection_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lista não encontrada.'; END IF;
  SELECT array_agg(recipe_id) INTO v_recipes FROM public.collection_recipes WHERE collection_id=p_collection_id;
  DELETE FROM public.collection_recipes WHERE collection_id=p_collection_id;
  DELETE FROM public.collections WHERE id=p_collection_id AND user_id=v_user;
  DELETE FROM public.favorites f WHERE f.user_id=v_user AND f.recipe_id=ANY(v_recipes)
    AND NOT EXISTS(SELECT 1 FROM public.collection_recipes cr JOIN public.collections c ON c.id=cr.collection_id WHERE c.user_id=v_user AND cr.recipe_id=f.recipe_id);
END $$;
REVOKE ALL ON FUNCTION public.delete_favorite_list(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_favorite_list(uuid) TO authenticated;
