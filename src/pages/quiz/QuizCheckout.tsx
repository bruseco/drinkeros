import { trackFunnel } from "@/lib/funnelTracking";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { supabase } from "@/integrations/supabase/client";
import { PROFILES } from "@/lib/quizLogic";
import {
  fetchQuizQuote,
  quizCall,
  quizOfferToken,
  type QuizQuote,
  trackQuizOffer,
} from "@/lib/quizOffer";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { mpRejectionMessage } from "@/lib/mpErrors";
import "./quizOffers.css";
const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Only quiz=1 reaches this form. The original registered/guest checkout is unchanged. */
export default function QuizCheckout() {
  const { productType, slug } = useParams(),
    profile = Object.values(PROFILES).find((p) =>
      p.productType === productType && p.slug === slug
    );
  const [quote, setQuote] = useState<QuizQuote | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null);
  const submitting = useRef(false), expiry = useRef(0);
  const refresh = useCallback(async () => {
    if (!profile) throw Error("Produto inválido");
    const q = await fetchQuizQuote(profile.id);
    setQuote(q);
    expiry.current = Date.now() +
      Math.max(0, Date.parse(q.expires_at) - Date.parse(q.server_now));
    return q;
  }, [profile]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const initial = await refresh();
        void trackQuizOffer(initial, "quiz_checkout_viewed", {
          destination: profile!.path,
        });
        const resumed = await quizCall("payment-status", {
          product: profile!.id,
        });
        if (resumed.status !== "none" && live) setResult(resumed);
        const key = await supabase.functions.invoke("get-mp-public-key");
        if (key.error || !key.data?.publicKey) {
          throw Error("Pagamento indisponível");
        }
        initMercadoPago(key.data.publicKey, { locale: "pt-BR" });
        if (live) setReady(true);
      } catch {
        if (live) {
          setError(
            "Não foi possível validar a oferta. Volte ao resultado do quiz.",
          );
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!quote?.active || result) return;
    const id = setTimeout(
      () =>
        void refresh().then(() =>
          setError(
            "O desconto expirou. Confira o preço atualizado antes de pagar.",
          )
        ).catch(() => setReady(false)),
      Math.max(0, expiry.current - Date.now()),
    );
    return () => clearTimeout(id);
  }, [quote, refresh, result]);
  useEffect(() => {
    if (
      !result || result.status === "approved" ||
      ["rejected", "cancelled", "refunded"].includes(result.status)
    ) return;
    const id = setInterval(async () => {
      try {
        const data = await quizCall("payment-status", { product: profile!.id });
        if (data.status === "approved") {
          setResult((previous: any) => ({ ...previous, status: "approved" }));
          import("@/lib/firePurchaseFromBackend").then((m) =>
            m.firePurchaseFromBackend({ source: "checkout-pix" })
          );
        } else if (data.id && !result.id) setResult(data);
        else if (["rejected", "cancelled", "refunded"].includes(data.status)) {
          setResult((previous: any) => ({ ...previous, status: data.status }));
        }
      } catch {
        /* Keep the accepted attempt visible on temporary network failure. */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [result?.id, result?.status]);
  const submit = async (formData: any) => {
    if (submitting.current || !quote || !profile) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const fresh = await refresh();
      if (fresh.price !== quote.price) {
        setError(
          "O preço foi atualizado. Confira o novo valor antes de pagar.",
        );
        return;
      }
      const { data, error: failure } = await supabase.functions.invoke(
        "create-mp-payment",
        {
          body: {
            product_type: profile.productType,
            slug: profile.slug,
            formData,
            expected_amount: fresh.price,
            quiz_offer_token: quizOfferToken(),
            quiz_payment_attempt: quizOfferToken() + ":" + profile.id,
          },
        },
      );
      if (failure || data?.error) {
        let payload = data;
        try {
          payload = await (failure as any)?.context?.json();
        } catch {}
        if (payload?.code === "quiz_price_changed") await refresh();
        if (payload?.code === "quiz_payment_pending") {
          setResult({ status: "processing" });
        }
        throw Error(
          payload?.error ||
            "Não foi possível confirmar o pagamento. Não tente novamente antes de conferir o status.",
        );
      }
      if (data.status === "rejected") {
        setError(mpRejectionMessage(data.status_detail));
      }
      setResult(data);
      trackInitiateCheckout({
        ...data,
        product_type: profile.productType,
        dedupe_key: profile.slug,
      });
      if (data.status === "approved") {
        import("@/lib/firePurchaseFromBackend").then((m) =>
          m.firePurchaseFromBackend({ source: "checkout-mp" })
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (!profile) {
    return (
      <main className="p-8">
        <p>Produto não encontrado.</p>
        <Link to="/quiz">Voltar ao quiz</Link>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-white text-gray-900 px-5 py-8">
      <section className="mx-auto max-w-lg">
        <Link to={profile.path} className="text-sm underline">
          ← Voltar à oferta
        </Link>
        <h1 className="mt-6 text-2xl font-bold">{profile.product}</h1>
        {quote && (
          <p className="my-5 text-4xl font-extrabold">{money(quote.price)}</p>
        )}
        <p className="mb-5 text-sm">
          Cartão ou Pix pelo Mercado Pago. O acesso chega no e-mail após a
          confirmação.{profile.productType === "club"
            ? " 12 meses de acesso, sem renovação automática."
            : ""}
        </p>
        {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
        {result?.status === "approved"
          ? (
            <div role="status">
              <h2 className="text-xl font-bold">Pagamento confirmado</h2>
              <p>Confira seu e-mail para acessar sua compra.</p>
              <Link to="/login" className="underline">Entrar na Drinkeros</Link>
            </div>
          )
          : result
          ? (
            <div role="status">
              <p>
                {["rejected", "cancelled"].includes(result.status)
                  ? mpRejectionMessage(result.status_detail)
                  : "Aguardando confirmação do pagamento. Não é necessário pagar novamente."}
              </p>
              {["rejected", "cancelled"].includes(result.status) && (
                <button
                  className="border rounded p-3 mt-3"
                  onClick={async () => {
                    try {
                      await quizCall("retry-payment", { product: profile.id });
                      await refresh();
                      setResult(null);
                      setError("");
                    } catch {
                      setError(
                        "Não foi possível liberar outra tentativa. Confira o pagamento antes de tentar novamente.",
                      );
                    }
                  }}
                >
                  Tentar novamente
                </button>
              )}
              {result.pix?.qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${result.pix.qr_code_base64}`}
                  alt="QR code Pix"
                  className="w-56 mx-auto"
                />
              )}
              {result.pix?.qr_code && (
                <>
                  <textarea
                    readOnly
                    aria-label="Código Pix"
                    className="w-full border p-2"
                    value={result.pix.qr_code}
                  />
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(result.pix.qr_code)}
                    className="border rounded p-3 mt-2"
                  >
                    Copiar código Pix
                  </button>
                </>
              )}
            </div>
          )
          : busy
          ? <p role="status">Processando pagamento…</p>
          : ready && quote
          ? (
            <Payment
              key={quote.price}
              initialization={{ amount: quote.price }}
              customization={{
                paymentMethods: {
                  creditCard: "all",
                  bankTransfer: ["pix"],
                  maxInstallments: profile.productType === "club" ? 1 : 12,
                },
                visual: { style: { theme: "default" }, hideFormTitle: true },
              }}
              onSubmit={({ formData }) => submit(formData)}
              onError={() =>
                setError(
                  "Não foi possível carregar o formulário. Recarregue a página.",
                )}
            />
          )
          : <p>Validando a oferta e carregando pagamento…</p>}
      </section>
    </main>
  );
}
