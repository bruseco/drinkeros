import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import drinkerosLogo from "@/assets/logotipo-drinkeros.png";
import SeoHead from "@/components/SeoHead";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { mpRejectionMessage } from "@/lib/mpErrors";
import { PixDisplay } from "@/pages/Checkout";
import RandObrigadoDemo from "@/components/landing/RandObrigadoDemo";

interface OfferState {
  status: string;
  expired: boolean;
  already_owned: boolean;
  is_guest: boolean;
  source_payment_id: string;
  email: string;
  first_name: string | null;
  product: { id: string; name: string; slug: string; cover_image_url: string | null };
  price: number;
}

type Stage = "loading" | "offer" | "paying" | "pix" | "done" | "unavailable";

let mpReady = false;
const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

export default function RandObrigado() {
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "1";
  const forceDemoReveal = isDemo && params.get("reveal") === "1";
  const ref = params.get("ref") || "";
  const navigate = useNavigate();
  const [state, setState] = useState<OfferState | null>(() => isDemo ? ({
    status: "eligible",
    expired: false,
    already_owned: false,
    is_guest: true,
    source_payment_id: "",
    email: "",
    first_name: null,
    product: {
      id: "",
      name: "Drinkeros Xperience + Workshop Além dos Clássicos",
      slug: "xperience-workshop-upsell",
      cover_image_url: null,
    },
    price: 97,
  }) : null);
  const [stage, setStage] = useState<Stage>(isDemo ? "offer" : "loading");
  const [pix, setPix] = useState<any>(null);
  const [brickReady, setBrickReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const purchaseFired = useRef(false);

  const call = (body: Record<string, unknown>) =>
    supabase.functions.invoke("rand-upsell", { body: { ref, ...body } });

  useEffect(() => {
    if (isDemo) return;
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    (async () => {
      const { data, error } = await call({ action: "get" });
      if (error || !data || data.error) { setStage("unavailable"); return; }
      const s = data as OfferState;
      setState(s);
      try { sessionStorage.setItem("purchase-account-email", s.email); } catch { /* ignore */ }
      if (s.status === "paid") setStage("done");
      else if (s.expired || s.already_owned || s.status === "declined") setStage("unavailable");
      else { setStage("offer"); void call({ action: "track", event: "view" }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, ref]);

  // Brick do Mercado Pago (segundo checkout, token novo)
  useEffect(() => {
    if (isDemo) return;
    if (stage !== "paying" || mpReady) { if (mpReady) setBrickReady(true); return; }
    supabase.functions.invoke("get-mp-public-key").then(({ data }) => {
      if (data?.publicKey) { initMercadoPago(data.publicKey, { locale: "pt-BR" }); mpReady = true; setBrickReady(true); }
    });
  }, [isDemo, stage]);

  // Polling do Pix
  useEffect(() => {
    if (isDemo) return;
    if (stage !== "pix") return;
    const t = setInterval(async () => {
      const { data } = await call({ action: "status" });
      if (data?.status === "paid") { clearInterval(t); onPaid(); }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, stage]);

  const onPaid = () => {
    setStage("done");
    if (!purchaseFired.current && hasSession) {
      purchaseFired.current = true;
      import("@/lib/firePurchaseFromBackend").then((m) => m.firePurchaseFromBackend({ source: "rand-upsell" }));
    }
  };

  const finish = () => {
    if (!state) { navigate("/app"); return; }
    if (hasSession) navigate("/app", { replace: true });
    else navigate(`/criar-conta?pid=${encodeURIComponent(state.source_payment_id)}`, { replace: true });
  };

  const showDemoNotice = () => toast.info("Modo de demonstração", {
    description: "Nenhuma cobrança ou alteração de acesso será realizada.",
  });
  const accept = () => {
    if (isDemo) { showDemoNotice(); return; }
    void call({ action: "track", event: "accept" });
    setStage("paying");
  };
  const decline = async () => {
    if (isDemo) { showDemoNotice(); return; }
    await call({ action: "track", event: "decline" });
    finish();
  };

  const onSubmit = async (formData: any) => {
    const { data, error } = await call({ action: "pay", formData });
    let msg = data?.error;
    if (error) {
      try { const b = await (error as any).context?.json?.(); msg = b?.error; } catch { /* ignore */ }
    }
    if (msg || error) { toast.error("Não foi possível pagar", { description: msg || "Tente novamente." }); return; }
    trackInitiateCheckout({
      amount: data.amount, currency: data.currency, product_name: data.product_name,
      product_type: "product", product_id: data.product_id, preference_id: String(data.id), id: data.id,
    });
    if (data.pix) { setPix(data.pix); setStage("pix"); }
    else if (data.status === "approved") { toast.success("Pagamento aprovado!"); onPaid(); }
    else if (data.status === "in_process" || data.status === "pending") toast.info("Pagamento em análise. Avisaremos por e-mail.");
    else toast.error("Pagamento recusado", { description: mpRejectionMessage(data.status_detail) });
  };

  const continueLabel = hasSession ? "Ir para meus cursos" : "Criar minha senha e acessar";

  if (isDemo) {
    return (
      <>
        <SeoHead title="Demonstração pós-compra RAND | Drinkeros" description="Prévia segura do pós-compra RAND." path="/rand/obrigado" />
        <RandObrigadoDemo forceReveal={forceDemoReveal} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-[env(safe-area-inset-bottom)]">
      <SeoHead title="Compra confirmada | Drinkeros" description="Sua compra do RAND está garantida." path="/rand/obrigado" />
      <header className="border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-center">
          <img src={drinkerosLogo} alt="Drinkeros" className="h-7 w-auto opacity-90" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {isDemo && (
          <div role="status" className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary">
            Modo de demonstração — nenhuma cobrança será realizada
          </div>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <CheckCircle2 className="w-7 h-7 text-green-500 shrink-0" />
          <div>
            <p className="font-semibold">Compra do RAND garantida{state?.first_name ? `, ${state.first_name}` : ""}!</p>
            <p className="text-sm text-white/70">Seu acesso aos clássicos já está liberado.</p>
          </div>
        </div>

        {stage === "loading" && (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        )}

        {stage === "offer" && state && (
          <section className="rounded-2xl border border-primary/40 bg-white/5 p-5 space-y-4">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary">
              <Sparkles className="w-3.5 h-3.5" /> Oferta única, só nesta página
            </p>
            <h1 className="text-2xl font-bold leading-tight">
              Você garantiu os clássicos; agora aprenda a criar seus próprios drinks.
            </h1>
            {state.product.cover_image_url && (
              <img src={state.product.cover_image_url} alt={state.product.name} className="w-full h-auto rounded-xl object-contain" />
            )}
            <p className="text-white/80">
              Leve <strong>Drinkeros Xperience + Workshop Além dos Clássicos</strong> e saia da receita pronta para a criação autoral.
            </p>
            <p className="text-3xl font-bold">{brl(state.price)} <span className="text-sm font-normal text-white/60">pagamento único</span></p>
            <Button size="lg" className="w-full h-14 text-base font-bold" onClick={accept}>
              Sim, quero criar meus próprios drinks
            </Button>
            <button type="button" onClick={decline} className="w-full text-center text-sm text-white/50 underline underline-offset-4 py-2">
              Não, obrigado. Continuar para o meu acesso
            </button>
          </section>
        )}

        {stage === "paying" && state && (
          <section className="space-y-3">
            <p className="text-sm text-white/70">
              {state.product.name} · <strong className="text-white">{brl(state.price)}</strong>
            </p>
            <div className="bg-white rounded-xl overflow-hidden p-2 text-black">
              {brickReady ? (
                <Payment
                  initialization={{ amount: state.price, payer: { email: state.email } }}
                  customization={{
                    paymentMethods: { creditCard: "all", bankTransfer: ["pix"], maxInstallments: 12, minInstallments: 1 },
                    visual: { style: { theme: "default" }, hideFormTitle: true },
                  }}
                  onSubmit={async ({ formData }) => { await onSubmit(formData); }}
                  onError={(e) => console.error("[upsell brick]", e)}
                />
              ) : (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              )}
            </div>
            <p className="flex items-center gap-2 text-xs text-white/50">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Por segurança, os dados do cartão são pedidos novamente e não ficam salvos conosco.
            </p>
            <button type="button" onClick={decline} className="w-full text-center text-sm text-white/50 underline underline-offset-4 py-2">
              Desistir e continuar para o meu acesso
            </button>
          </section>
        )}

        {stage === "pix" && pix && state && (
          <PixDisplay pix={pix} amount={state.price} onBack={() => { setPix(null); setStage("paying"); }} />
        )}

        {stage === "done" && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-semibold">Xperience + Workshop garantidos!</p>
            <p className="text-sm text-white/70">Os dois cursos serão liberados na sua conta.</p>
            <Button size="lg" className="w-full h-12" onClick={finish}>{continueLabel}</Button>
          </section>
        )}

        {stage === "unavailable" && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center space-y-3">
            <p className="text-sm text-white/70">Tudo pronto. Seu acesso ao RAND está garantido.</p>
            <Button size="lg" className="w-full h-12" onClick={finish}>{continueLabel}</Button>
          </section>
        )}
      </main>
    </div>
  );
}
