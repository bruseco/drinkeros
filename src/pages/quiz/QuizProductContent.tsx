import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ProfileId } from "@/lib/quizLogic";
import ClubRecipeLoop from "@/components/landing/ClubRecipeLoop";
import ClubFavoriteDemo from "@/components/landing/ClubFavoriteDemo";
import ClubShoppingDemo from "@/components/landing/ClubShoppingDemo";
import ClubCommunityDemo from "@/components/landing/ClubCommunityDemo";
import TestimonialsCarousel from "@/components/landing/TestimonialsCarousel";
const pages = {
  xperience: lazy(() => import("./content/DrinkerosXperience")),
  mixologia: lazy(() => import("./content/MixologiaAvancada")),
  bordo: lazy(() => import("./content/BartenderABordo")),
  delivery: lazy(() => import("./content/DrinkDeliveryEngarrafados")),
  eventos: lazy(() => import("./content/BarParaEventos")),
};
function PackContent() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["quiz-pack-content"],
    queryFn: async () => {
      const c = await supabase.from("combos").select("id,name,description").eq(
        "slug",
        "pacote-6-e-books",
      ).maybeSingle();
      if (c.error || !c.data) throw Error("Combo não encontrado");
      const ebooks = await supabase.from("combo_ebooks").select(
        "ebook:ebooks(name,description,cover_image_url)",
      ).eq("combo_id", c.data.id);
      if (ebooks.error) throw ebooks.error;
      return { ...c.data, ebooks: ebooks.data };
    },
  });
  return (
    <div className="quiz-offer-body">
      <section>
        <h2>Seus 6 e-books de drinks</h2>
        {isLoading
          ? <p>Carregando o conteúdo…</p>
          : isError
          ? <p>Não foi possível carregar a composição do pacote.</p>
          : (
            <>
              <p>{data?.description}</p>
              <div className="quiz-content-grid">
                {data?.ebooks.map((row: any, i) => (
                  <article key={i}>
                    <img
                      src={row.ebook?.cover_image_url}
                      alt={row.ebook?.name || ""}
                      loading="lazy"
                    />
                    <h3>{row.ebook?.name}</h3>
                    <p>{row.ebook?.description}</p>
                  </article>
                ))}
              </div>
            </>
          )}
      </section>
      <section>
        <h2>Acesso digital</h2>
        <p>
          Após a confirmação do pagamento, você recebe as instruções de acesso
          no e-mail informado.
        </p>
      </section>
    </div>
  );
}
export default function QuizProductContent(
  { product }: { product: ProfileId },
) {
  if (product === "pack") return <PackContent />;
  if (product === "clube") {
    return (
      <div className="quiz-offer-body">
        <section>
          <h2>Receitas em vídeo</h2>
          <ClubRecipeLoop />
        </section>
        <section>
          <h2>Salve suas receitas</h2>
          <ClubFavoriteDemo />
        </section>
        <section>
          <h2>Organizador de festas</h2>
          <ClubShoppingDemo />
        </section>
        <section>
          <h2>Comunidade</h2>
          <ClubCommunityDemo />
        </section>
        <section>
          <h2>O que os membros dizem</h2>
          <TestimonialsCarousel staticLayout />
        </section>
        <section>
          <h2>12 meses de acesso</h2>
          <p>
            Mais de 1.000 receitas em vídeo, xaropes artesanais e descontos nos
            cursos.
          </p>
          <details>
            <summary>Como recebo o acesso?</summary>
            <p>
              Após a confirmação do pagamento, as instruções chegam no e-mail
              informado.
            </p>
          </details>
        </section>
      </div>
    );
  }
  const Page = pages[product];
  return (
    <Suspense fallback={<p>Carregando conteúdo…</p>}>
      <Page />
    </Suspense>
  );
}
