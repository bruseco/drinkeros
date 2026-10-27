import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useQuizPack() {
  return useQuery({
    queryKey: ["quiz-pack-content"],
    queryFn: async () => {
      const combo = await supabase.from("combos").select(
        "id,name,description,cover_image_url",
      ).eq("slug", "pacote-6-e-books").maybeSingle();
      if (combo.error || !combo.data) throw Error("Combo não encontrado");
      const ebooks = await supabase.from("combo_ebooks").select(
        "ebook:ebooks(name,description,cover_image_url)",
      ).eq("combo_id", combo.data.id);
      if (ebooks.error) throw ebooks.error;
      return { ...combo.data, ebooks: ebooks.data };
    },
  });
}
