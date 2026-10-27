import QuizPurchaseButton, { QuizPurchaseContext } from "./QuizPurchaseButton";
import QuizFooter from "./QuizFooter";
import QuizPackHero from "./QuizPackHero";
import logo from "@/assets/logotipo-drinkeros.png";
import { quizInstallmentEstimate } from "@/lib/quizInstallments";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  allowedQuizProducts,
  type ProfileId,
  PROFILES,
  quizAdParams,
} from "@/lib/quizLogic";
import {
  fetchQuizQuote,
  type QuizQuote,
  trackQuizOffer,
} from "@/lib/quizOffer";
import { trackFbEvent } from "@/lib/metaPixel";
import QuizProductContent from "./QuizProductContent";
import "./quizOffers.css";
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export default function QuizOfferPage({ product }: { product: ProfileId }) {
  const [quote, setQuote] = useState<QuizQuote | null>(null),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState(0),
    [busy, setBusy] = useState(false);
  const location = useLocation(),
    navigate = useNavigate(),
    deadline = useRef(0),
    expiryLogged = useRef(false),
    profile = PROFILES[product];
  const metadata = useCallback(
    (q: QuizQuote) => ({
      ...q.attribution,
      path: q.path,
      product,
      profile: product,
      session_id: q.session_id,
    }),
    [product],
  );
  const refresh = useCallback(async () => {
    const q = await fetchQuizQuote(product);
    deadline.current = Date.now() +
      Math.max(
        0,
        new Date(q.expires_at).getTime() - new Date(q.server_now).getTime(),
      );
    setQuote(q);
    setRemaining(
      Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
    );
    setError("");
    return q;
  }, [product]);
  useEffect(() => {
    let live = true;
    setQuote(null);
    refresh().then((q) => {
      if (live) {
        void trackQuizOffer(q, "quiz_offer_viewed");
        trackFbEvent("ViewContent", {
          content_name: profile.product,
          content_type: "product",
          value: q.price,
          currency: "BRL",
        }, { dedupeKey: `quiz-offer:${q.session_id}:${product}` });
      }
    }).catch(() => {
      if (live) {
        setError("Conclua o quiz para consultar seu desconto exclusivo.");
      }
    });
    return () => {
      live = false;
    };
  }, [refresh, metadata, profile.product, product]);
  useEffect(() => {
    const tick = () => {
      const secs = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setRemaining(secs);
      if (deadline.current && secs === 0 && quote?.active) {
        setQuote((q) => q ? { ...q, price: q.full_price, active: false } : q);
        if (!expiryLogged.current) {
          expiryLogged.current = true;
          void trackQuizOffer(quote, "quiz_discount_expired");
        }
        void refresh().catch(() =>
          setError(
            "Não foi possível atualizar o preço. Recarregue antes de comprar.",
          )
        );
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote, metadata, refresh]);
  const buy = async () => {
    if (busy || !quote) return;
    setBusy(true);
    try {
      const fresh = await refresh();
      await Promise.race([
        trackQuizOffer(fresh, "quiz_checkout_clicked"),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      const params = new URLSearchParams(fresh.attribution);
      params.set("quiz", "1");
      params.set("quiz_profile", product);
      navigate(`/checkout/${profile.productType}/${profile.slug}?${params}`);
    } catch {
      setError("Não foi possível confirmar o preço. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const alternative = quote && quote.recommended === product
    ? allowedQuizProducts(quote.recommended, quote.path).find((p) =>
      p !== product
    )
    : undefined;
  const altQuote = quote?.alternatives?.find((q) => q.product === alternative);
  const alternativePrice = altQuote
    ? money(quote?.active ? altQuote.price : altQuote.full_price)
    : "";
  const alternativeUrl = alternative
    ? `${PROFILES[alternative].path}?${new URLSearchParams(
      quote?.attribution || quizAdParams(location.search),
    )}`
    : "";
  return (
    <QuizPurchaseContext.Provider value={{ buy, busy, available: !!quote }}>
      <main
        className={`quiz-offer-page${
          product === "pack" ? " quiz-pack-offer" : ""
        }`}
      >
        <div className="quiz-offer-banner" role="status">
          {quote
            ? (quote.active
              ? (
                <>
                  Você ganhou {money(quote.full_price - quote.price)}{" "}
                  de desconto pelo quiz!{" "}
                  <strong>
                    Expira em {String(Math.floor(remaining / 60)).padStart(
                      2,
                      "0",
                    )}:{String(
                      remaining % 60,
                    ).padStart(2, "0")}
                  </strong>
                </>
              )
              : "A condição do quiz expirou. Preço regular atualizado.")
            : "Oferta exclusiva do quiz"}
        </div>
        <section className="quiz-offer-hero">
          {product === "pack" && (
            <>
              <img className="quiz-pack-logo" src={logo} alt="Drinkeros" />
              <QuizPackHero />
            </>
          )}
          <p className="quiz-offer-eyebrow">
            Seu próximo passo · {profile.product}
          </p>
          <h1>{profile.title}</h1>
          <p>{profile.text}</p>
          {error && <p role="alert">{error}</p>}
          {quote
            ? (
              <>
                <div className="quiz-offer-price">
                  {quote.active && <del>{money(quote.full_price)}</del>}
                  <strong>{money(quote.price)}</strong>
                </div>
                <p className="quiz-installment">
                  {profile.productType !== "club"
                    ? (
                      <>
                        Simulação:{" "}
                        <strong>
                          12x de {money(quizInstallmentEstimate(quote.price))}
                        </strong>, com juros de 4,49% a.m. Parcelas finais
                        conforme seu cartão no Mercado Pago.
                      </>
                    )
                    : "Pagamento único por cartão ou Pix. 12 meses de acesso."}
                </p>
                <QuizPurchaseButton />
                <p className="quiz-secure">
                  Pagamento seguro · acesso após confirmação
                </p>
              </>
            )
            : (
              <Link className="quiz-offer-buy" to="/quiz">
                {error ? "Fazer o quiz" : "Carregando oferta…"}
              </Link>
            )}
          {product === "xperience"
            ? (
              <video
                className="quiz-product-video"
                src="https://pvjlcfhqueibjnkuzzna.supabase.co/storage/v1/object/public/landing-assets/drinkeros-xperience/clipe.mp4"
                controls
                playsInline
                preload="metadata"
                aria-label="Apresentação do Drinkeros Xperience"
              />
            )
            : product !== "pack"
            ? (
              <div className="quiz-avatar-placeholder">
                Vídeo de apresentação do seu perfil — em breve
              </div>
            )
            : null}
          {alternative && altQuote && (
            <Link className="quiz-plan-b" to={alternativeUrl}>
              {quote?.path === "casa"
                ? `Prefere começar por ${
                  PROFILES[alternative].product
                } por ${alternativePrice}?`
                : `Ainda não é a hora? Comece pelo Clube por ${alternativePrice} e garanta desconto no curso quando decidir.`}
              {" "}
              <span>Consultar a oferta dentro do mesmo prazo →</span>
            </Link>
          )}
        </section>
        <QuizProductContent product={product} />
        <QuizFooter />
      </main>
    </QuizPurchaseContext.Provider>
  );
}
