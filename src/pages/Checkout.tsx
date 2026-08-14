import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle2, Copy, CreditCard, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import drinkerosLogo from "@/assets/logotipo-drinkeros.png";
import { trackFbEvent, trackInitiateCheckout, waitForPixelFlush } from "@/lib/metaPixel";
import { useViewContent } from "@/hooks/useViewContent";
import { useVipDiscount } from "@/hooks/useVipDiscount";
import { applyVipDiscountFor, getVipPriceFor } from "@/lib/vipDiscount";
import { useYouthDiscount } from "@/hooks/useYouthDiscount";
import FiscalAddressDialog from "@/components/user/FiscalAddressDialog";
import { mpRejectionMessage } from "@/lib/mpErrors";

type ClubMethod = "card" | "pix";

type ProductType = "course" | "ebook" | "combo" | "package" | "club";

const TABLE_MAP: Record<Exclude<ProductType, "club">, string> = {
  course: "courses",
  ebook: "ebooks",
  combo: "combos",
  package: "packages",
};

const CLUB_PRODUCTS: Record<string, Product> = {
  "clube-anual": {
    id: "club",
    name: "Clube dos Drinkeros · Anual",
    slug: "clube-anual",
    price: 47,
    cover_image_url: null,
    description: "Acesso por 12 meses às receitas exclusivas e benefícios do Clube.",
  },
  clube: {
    id: "club",
    name: "Clube dos Drinkeros · Mensal",
    slug: "clube",
    price: 9.9,
    cover_image_url: null,
    description: "Acesso por 30 dias às receitas exclusivas e benefícios do Clube.",
  },
};

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  cover_image_url: string | null;
  description: string | null;
}

interface PixData {
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
}

let mpInitialized = false;

export default function Checkout() {
  const { productType, slug } = useParams<{ productType: ProductType; slug: string }>();
  const navigate = useNavigate();

  const [publicKeyReady, setPublicKeyReady] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pixResult, setPixResult] = useState<PixData | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [payerEmail, setPayerEmail] = useState<string | null>(null);
  const [clubMethod, setClubMethod] = useState<ClubMethod>("card");
  const [userId, setUserId] = useState<string | null>(null);
  const [buyerCpf, setBuyerCpf] = useState<string>("");
  const [buyerName, setBuyerName] = useState<string>("");
  const [addressComplete, setAddressComplete] = useState(false);
  const [addressPromptRedirect, setAddressPromptRedirect] = useState<string | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  const vip = useVipDiscount();
  const youth = useYouthDiscount();
  const isClub = productType === "club";
  // Sócio/Vitalício recebem desconto escalonado (80% por 7d → 50% depois) apenas em produtos avulsos.
  const vipPercent = !isClub && vip.ready && vip.isVip ? vip.percent : 0;
  const isVip = vipPercent > 0;
  // Jovem Bartender (≤24 anos): R$27 no anual do Clube.
  const isYouthClubAnual = isClub && slug === "clube-anual" && youth.isYouth;

  // 1. Carrega Public Key e inicializa MP SDK (Clube e produtos avulsos agora usam Mercado Pago)
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mp-public-key");
        if (error) throw error;
        if (!data?.publicKey) throw new Error("Public Key não configurada");
        if (!mpInitialized) {
          initMercadoPago(data.publicKey, { locale: "pt-BR" });
          mpInitialized = true;
        }
        setPublicKeyReady(true);
      } catch (err: any) {
        toast.error("Erro ao iniciar checkout", { description: err.message });
      }
    })();
  }, []);


  // 2. Carrega produto + checa VIP
  useEffect(() => {
    if (!productType || !slug) {
      navigate("/");
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);

        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("cep, address_street, address_number, address_neighborhood, address_city, address_state")
            .eq("user_id", user.id)
            .maybeSingle();
          const p = prof as any;
          setAddressComplete(
            !!p &&
              String(p.cep || "").replace(/\D/g, "").length === 8 &&
              !!String(p.address_street || "").trim() &&
              !!String(p.address_number || "").trim() &&
              !!String(p.address_neighborhood || "").trim() &&
              !!String(p.address_city || "").trim() &&
              !!String(p.address_state || "").trim(),
          );
        }

        if (productType === "club") {
          if (!user) {
            navigate(`/signup?redirect=/checkout/club/${slug}`);
            return;
          }
          const clubProd = CLUB_PRODUCTS[slug as string] || CLUB_PRODUCTS["clube-anual"];
          const adjusted = (slug === "clube-anual" && youth.isYouth)
            ? { ...clubProd, price: youth.price }
            : clubProd;
          setProduct(adjusted);
          setPayerEmail(user.email ?? "");
          setLoading(false);
          return;
        }

        if (!TABLE_MAP[productType]) {
          navigate("/");
          return;
        }

        const { data: prod, error: prodErr } = await supabase
          .from(TABLE_MAP[productType] as any)
          .select("id, name, slug, price, cover_image_url, description")
          .eq("slug", slug)
          .maybeSingle();
        if (prodErr || !prod) {
          toast.error("Produto não encontrado");
          navigate("/");
          return;
        }
        setProduct(prod as unknown as Product);

        if (user) {
          setPayerEmail(user.email ?? "");
        } else {
          setPayerEmail("");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [productType, slug, navigate, youth.isYouth, youth.loading]);

  const finalPrice = useMemo(() => {
    if (!product) return 0;
    if (isClub) return Number(product.price);
    return vipPercent > 0
      ? getVipPriceFor(product.slug, Number(product.price), vipPercent)
      : Number(product.price);
  }, [product, vipPercent, isClub]);

  // Etapa 3: após o pagamento, pede o endereço fiscal (não bloqueante).
  const finishAfterPayment = (redirect: string, delay = 1500) => {
    if (addressComplete) {
      setTimeout(() => navigate(redirect), delay);
    } else {
      setTimeout(() => setAddressPromptRedirect(redirect), 600);
    }
  };

  // ViewContent da tela de checkout
  useViewContent({
    key: product ? `${productType}:${product.slug}` : null,
    content_name: product?.name,
    content_category: 'checkout',
    content_type: 'product',
    content_ids: product?.id ? [product.id] : undefined,
    value: finalPrice,
    currency: 'BRL',
  });

  // InitiateCheckout NÃO dispara no page-load. Ele dispara somente após
  // a criação efetiva do checkout (Stripe / MP) — ver handleClubCheckout e onSubmit.

  // 3. Polling do status do Pix
  useEffect(() => {
    if (!pixPaymentId || paid) return;
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/get-mp-payment-status?id=${pixPaymentId}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const j = await resp.json();
      if (j.status === "approved") {
          setPaid(true);
          clearInterval(interval);
          // Dispara Purchase com dados REAIS da transação (vindos do banco via webhook)
          import('@/lib/firePurchaseFromBackend').then(m =>
            m.firePurchaseFromBackend({ source: 'checkout-pix' })
          );
          finishAfterPayment(isClub ? "/pv-clube?clube=success" : `/${product?.slug}?checkout=success`, 2000);
        }
      } catch (_) { /* ignore */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [pixPaymentId, paid, navigate, product, isClub]);

  const onSubmit = async (formData: any) => {
    if (!product) return;
    // CPF e nome vêm do próprio formulário do Mercado Pago.
    const mpCpf = String(formData?.payer?.identification?.number || "").replace(/\D/g, "");
    const mpName = [formData?.payer?.first_name, formData?.payer?.last_name]
      .filter(Boolean).join(" ").trim();
    if (mpCpf) setBuyerCpf(mpCpf);
    if (mpName) setBuyerName(mpName);
    const fiscalData = { cpf: mpCpf, full_name: mpName } as Record<string, string>;
    setSubmitting(true);
    try {
      // Cartão no Clube → cria assinatura recorrente (preapproval) com card_token_id
      if (isClub && clubMethod === "card" && formData?.token) {
        const { data, error } = await supabase.functions.invoke("create-mp-subscription", {
          body: {
            slug: product.slug,
            card_token_id: formData.token,
            payer_email: formData?.payer?.email || payerEmail,
            identification: formData?.payer?.identification,
          },
        });
        if (error) {
          // 409 = já existe assinatura ativa para este e-mail (evita cobrança duplicada).
          let serverMsg = "";
          let code = "";
          try {
            const ctx: any = (error as any).context;
            const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
            serverMsg = body?.error || "";
            code = body?.code || "";
          } catch { /* ignore */ }
          if (code === "subscription_exists") {
            toast.info(serverMsg || "Você já possui uma assinatura ativa do Clube.");
            setTimeout(() => navigate("/pv-clube?clube=success"), 1500);
            return;
          }
          throw new Error(serverMsg || error.message);
        }
        if (data?.code === "subscription_exists") {
          toast.info(data.error || "Você já possui uma assinatura ativa do Clube.");
          setTimeout(() => navigate("/pv-clube?clube=success"), 1500);
          return;
        }
        if (data?.error) throw new Error(data.error);


        // InitiateCheckout — assinatura MP criada com sucesso (qualquer status final).
        trackInitiateCheckout({
          amount: data.amount,
          currency: data.currency,
          product_name: data.product_name,
          product_type: 'subscription',
          product_id: data.product_id,
          preference_id: String(data.id || ''),
          id: data.id,
        });

        if (data?.status === "authorized") {
          setPaid(true);
          toast.success("Assinatura ativada! Renovação automática anual.");
          import('@/lib/firePurchaseFromBackend').then(m =>
            m.firePurchaseFromBackend({ source: 'checkout-mp-subscription' })
          );
          finishAfterPayment("/pv-clube?clube=success");
        } else if (data?.status === "pending") {
          toast.info("Assinatura em análise. Você receberá a confirmação em breve.");
          setTimeout(() => navigate("/pv-clube?clube=pending"), 1800);
        } else {
          toast.error("Não foi possível ativar a assinatura", { description: mpRejectionMessage(data?.status_detail) });
        }
        return;
      }

      // Pix (Clube ou produto avulso) ou Cartão de produto avulso → pagamento único
      const { data, error } = await supabase.functions.invoke("create-mp-payment", {
        body: { product_type: productType, slug: product.slug, formData, fiscal: fiscalData },
      });
      if (error) {
        // Erro 400 do servidor (ex.: dados fiscais incompletos) vem no corpo da resposta.
        let serverMsg = "";
        let code = "";
        try {
          const ctx: any = (error as any).context;
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          serverMsg = body?.error || "";
          code = body?.code || "";
        } catch { /* ignore */ }
        throw new Error(serverMsg || error.message);
      }
      if (data?.error) throw new Error(data.error);


      // InitiateCheckout — pagamento MP criado com sucesso (Pix gerado, cartão aprovado/recusado, etc.).
      trackInitiateCheckout({
        amount: data.amount,
        currency: data.currency,
        product_name: data.product_name,
        product_type: isClub ? 'subscription' : 'product',
        product_id: data.product_id,
        preference_id: String(data.id || ''),
        id: data.id,
      });

      const isPixResponse =
        data.payment_method_id === "pix" &&
        !!data.pix && (!!data.pix.qr_code || !!data.pix.qr_code_base64);

      if (data?.id) setLastPaymentId(String(data.id));

      if (isPixResponse) {
        setPixResult(data.pix);
        setPixPaymentId(String(data.id));

      } else if (data.status === "approved") {
        setPaid(true);
        toast.success("Pagamento aprovado!");
        import('@/lib/firePurchaseFromBackend').then(m =>
          m.firePurchaseFromBackend({ source: 'checkout-mp-card' })
        );
        finishAfterPayment(isClub ? "/pv-clube?clube=success" : `/${product.slug}?checkout=success`);
      } else if (data.status === "in_process" || data.status === "pending") {
        toast.info("Pagamento em análise. Você receberá uma confirmação em breve.");
        setTimeout(() => navigate(isClub ? "/pv-clube?clube=pending" : `/${product.slug}?checkout=pending`), 2000);
      } else {
        toast.error("Pagamento recusado", { description: mpRejectionMessage(data.status_detail) });
      }
    } catch (err: any) {
      const raw = String(err?.message || "");
      const friendly = /non-2xx|Failed to fetch|FunctionsHttpError/i.test(raw) || !raw
        ? "Não foi possível concluir o pagamento. Recarregue a página e tente novamente."
        : raw;
      toast.error("Erro no pagamento", { description: friendly });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !publicKeyReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={isClub ? "/pv-clube" : `/${product.slug}`} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <img src={drinkerosLogo} alt="Drinkeros" className="h-7 w-auto opacity-90" />
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span className="hidden sm:inline">Pagamento seguro</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-[1fr_380px] gap-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Finalizar compra</h1>
          <p className="text-sm text-white/60 mb-5">
            {isClub
              ? "Escolha cartão (renovação automática) ou Pix (1 ano sem renovação)."
              : "Escolha cartão ou Pix abaixo. Tudo dentro da Drinkeros."}
          </p>

          {paid ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-1">Tudo certo!</h2>
              <p className="text-sm text-white/70">Liberando seu acesso...</p>
            </div>
          ) : pixResult ? (
            <PixDisplay
              pix={pixResult}
              amount={finalPrice}
              onBack={() => {
                setPixResult(null);
                setPixPaymentId(null);
              }}
            />

          ) : (
              {submitting ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-white">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-base font-medium">Processando...</p>
                  <p className="text-sm text-white/60">Aguarde enquanto confirmamos seu pagamento.</p>
                </div>
              ) : (
                <>
                  {isClub && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setClubMethod("card")}
                        className={`rounded-xl border p-3 text-left transition ${
                          clubMethod === "card"
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CreditCard className="w-4 h-4" />
                          <span className="text-sm font-medium">Cartão</span>
                          <span className="ml-auto text-[10px] uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                            Recomendado
                          </span>
                        </div>
                        <p className="text-xs text-white/60 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Renovação automática anual
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setClubMethod("pix")}
                        className={`rounded-xl border p-3 text-left transition ${
                          clubMethod === "pix"
                            ? "border-primary bg-primary/10"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <QrCode className="w-4 h-4" />
                          <span className="text-sm font-medium">Pix</span>
                        </div>
                        <p className="text-xs text-white/60">Acesso por 12 meses · sem renovação</p>
                      </button>
                    </div>
                  )}


                  <div className="bg-white rounded-xl overflow-hidden p-2 sm:p-4 text-black">
                    {payerEmail !== null ? (
                      <Payment
                        key={`brick-${finalPrice}-${isClub ? clubMethod : "all"}`}
                        initialization={{
                          amount: finalPrice,
                          ...(payerEmail ? { payer: { email: payerEmail } } : {}),
                        }}
                        customization={{
                          paymentMethods: isClub
                            ? {
                                creditCard: clubMethod === "card" ? "all" : undefined,
                                bankTransfer: clubMethod === "pix" ? ["pix"] : undefined,
                                maxInstallments: 1,
                                minInstallments: 1,
                              }
                            : {
                                creditCard: "all",
                                bankTransfer: ["pix"],
                                maxInstallments: 12,
                                minInstallments: 1,
                              },
                          visual: {
                            style: { theme: "default" },
                            hideFormTitle: true,
                          },
                        }}
                        onReady={() => {
                          console.log("[MP Brick] ready", { amount: finalPrice, isClub, clubMethod });
                        }}
                        onSubmit={async ({ formData }) => {
                          await onSubmit(formData);
                        }}
                        onError={(err) => {
                          console.error("[Brick error]", err);
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-8 text-black/60 text-sm gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando pagamento...
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <aside className="bg-white/5 border border-white/10 rounded-xl p-5 h-fit md:sticky md:top-20">
          <p className="text-xs uppercase tracking-wider text-white/50 mb-3">Resumo do pedido</p>
          <div className="flex gap-3 mb-4">
            {product.cover_image_url && (
              <img
                src={product.cover_image_url}
                alt={product.name}
                className="w-16 h-16 rounded object-cover bg-white/5"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-tight">{product.name}</p>
              {product.description && (
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{product.description}</p>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span className={isVip && !isClub ? "line-through text-white/40" : ""}>
                R$ {Number(product.price).toFixed(2).replace(".", ",")}
              </span>
            </div>
            {isVip && !isClub && (
              <div className="flex justify-between text-sm text-primary">
                <span>Desconto Sócio do Clube (-{vipPercent}%)</span>
                <span>−R$ {(Number(product.price) - finalPrice).toFixed(2).replace(".", ",")}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-white/10">
              <span>Total {isClub && clubMethod === "card" ? "/ ano" : ""}</span>
              <span>R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
            </div>
            {isClub && (
              <p className="text-[11px] text-white/50 pt-1">
                {clubMethod === "card"
                  ? "Cobrança automática a cada 12 meses. Cancele quando quiser."
                  : "Pagamento único. Avisamos antes do vencimento para renovar."}
              </p>
            )}
          </div>

          <div className="mt-5 flex items-start gap-2 text-xs text-white/50">
            <ShieldCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p>Pagamento processado com criptografia. Seus dados de cartão não passam pelos nossos servidores.</p>
          </div>
        </aside>
      </div>

      <FiscalAddressDialog
        open={!!addressPromptRedirect}
        userId={userId}
        buyerEmail={payerEmail}
        paymentId={lastPaymentId}
        initialName={buyerName}
        initialCpf={buyerCpf}
        onDone={() => {
          const target = addressPromptRedirect;
          setAddressPromptRedirect(null);
          if (target) navigate(target);
        }}
      />
    </div>
  );
}

function PixDisplay({ pix, amount, onBack }: { pix: PixData; amount: number; onBack?: () => void }) {
  const copy = () => {
    navigator.clipboard.writeText(pix.qr_code);
    toast.success("Código Pix copiado!");
  };
  return (
    <div className="bg-white text-black rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-1">Pague com Pix</h2>
      <p className="text-sm text-black/60 mb-4">
        Total: <strong>R$ {amount.toFixed(2).replace(".", ",")}</strong>. Aprovação automática em segundos.
      </p>
      <div className="flex flex-col items-center gap-4">
        {pix.qr_code_base64 && (
          <img
            src={`data:image/png;base64,${pix.qr_code_base64}`}
            alt="QR Code Pix"
            className="w-56 h-56 border rounded-lg"
          />
        )}
        <button
          onClick={copy}
          className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg font-medium hover:bg-black/80"
        >
          <Copy className="w-4 h-4" /> Copiar código Pix
        </button>
        {pix.qr_code && (
          <textarea
            readOnly
            value={pix.qr_code}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full text-[11px] leading-snug bg-black/5 border border-black/10 rounded-lg p-2 h-20 resize-none"
          />
        )}
        <p className="text-xs text-black/50 text-center">
          Após pagar, esta tela libera o acesso automaticamente.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 border border-black/15 text-black py-3 rounded-lg font-medium hover:bg-black/5"
          >
            <CreditCard className="w-4 h-4" /> Prefiro pagar com cartão
          </button>
        )}
      </div>
    </div>
  );
}

