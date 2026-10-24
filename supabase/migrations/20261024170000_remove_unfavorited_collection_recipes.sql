CREATE FUNCTION public.remove_unfavorited_collection_recipes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.collection_recipes cr USING public.collections c
  WHERE cr.collection_id = c.id AND c.user_id = OLD.user_id AND cr.recipe_id = OLD.recipe_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_unfavorited_collection_recipes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER remove_unfavorited_collection_recipes
  AFTER DELETE ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.remove_unfavorited_collection_recipes();
