import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import drinkerosLogo from "@/assets/logotipo-drinkeros.png";

type ProductType = "course" | "ebook" | "combo" | "package" | "club";

const TABLE_MAP: Record<Exclude<ProductType, "club">, string> = {
  course: "courses",
  ebook: "ebooks",
  combo: "combos",
  package: "packages",
};

const CLUB_PRODUCT: Product = {
  id: "club",
  name: "Clube dos Drinkeros · Anual",
  slug: "clube",
  price: 69,
  cover_image_url: null,
  description: "Acesso anual às receitas exclusivas e benefícios do Clube.",
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
  const [isVip, setIsVip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixResult, setPixResult] = useState<PixData | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [payerEmail, setPayerEmail] = useState<string | null>(null);

  // 1. Carrega Public Key e inicializa MP SDK
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

        if (productType === "club") {
          // Assinatura do Sócio do Clube é recorrente e fica no Stripe.
          // Mercado Pago é usado apenas para pagamentos avulsos (cursos/ebooks).
          if (!user) {
            navigate(`/signup?redirect=/checkout/club/${slug}`);
            return;
          }
          // slug "clube-anual" → plano anual à vista (one-time, aceita PIX)
          // slug "clube" (qualquer outro) → assinatura mensal recorrente
          const fnName = slug === "clube-anual" ? "create-vip-annual-checkout" : "create-vip-checkout";
          try {
            const { data, error } = await supabase.functions.invoke(fnName);
            if (error) throw error;
            if (!data?.url) throw new Error("URL do checkout não retornada");
            window.location.href = data.url;
          } catch (err: any) {
            toast.error("Erro ao iniciar assinatura", { description: err.message });
            navigate("/clube");
          }
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
          const { data: planData } = await supabase.rpc("get_user_plan", { _user_id: user.id });
          setIsVip(planData === "vip");
        } else {
          setPayerEmail("");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [productType, slug, navigate]);

  const finalPrice = useMemo(() => {
    if (!product) return 0;
    return isVip ? Math.round(Number(product.price) * 0.2 * 100) / 100 : Number(product.price);
  }, [product, isVip]);

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
          setTimeout(() => navigate(productType === "club" ? "/clube?clube=success" : `/${product?.slug}?checkout=success`), 2000);
        }
      } catch (_) { /* ignore */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [pixPaymentId, paid, navigate, product, productType]);

  const onSubmit = async (formData: any) => {
    if (!product) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-payment", {
        body: { product_type: productType, slug: product.slug, formData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.pix) {
        setPixResult(data.pix);
        setPixPaymentId(String(data.id));
      } else if (data.status === "approved") {
        setPaid(true);
        toast.success("Pagamento aprovado!");
        setTimeout(() => navigate(productType === "club" ? "/clube?clube=success" : `/${product.slug}?checkout=success`), 1500);
      } else if (data.status === "in_process" || data.status === "pending") {
        toast.info("Pagamento em análise. Você receberá uma confirmação em breve.");
        setTimeout(() => navigate(productType === "club" ? "/clube?clube=pending" : `/${product.slug}?checkout=pending`), 2000);
      } else {
        toast.error("Pagamento recusado", { description: data.status_detail || "Tente outro cartão." });
      }
    } catch (err: any) {
      toast.error("Erro no pagamento", { description: err.message });
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
      {/* Header */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={productType === "club" ? "/clube" : `/${product.slug}`} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
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
        {/* Coluna esquerda - Pagamento */}
        <div>
          <h1 className="text-xl font-semibold mb-1">Finalizar compra</h1>
          <p className="text-sm text-white/60 mb-5">Escolha cartão ou Pix abaixo. Tudo dentro da Drinkeros.</p>

          {paid ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-1">Pagamento aprovado!</h2>
              <p className="text-sm text-white/70">Liberando seu acesso...</p>
            </div>
          ) : pixResult ? (
            <PixDisplay pix={pixResult} amount={finalPrice} />
          ) : (
            <div className="bg-white rounded-xl overflow-hidden p-2 sm:p-4 text-black">
              {payerEmail !== null ? (
                <Payment
                  key={`brick-${finalPrice}`}
                  initialization={{
                    amount: finalPrice,
                    ...(payerEmail ? { payer: { email: payerEmail } } : {}),
                  }}
                  customization={{
                    paymentMethods: {
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
                    console.log("[MP Brick] ready", { amount: finalPrice, maxInstallments: 12 });
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
              {submitting && (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-black/70">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando pagamento...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita - Resumo */}
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
              <span className={isVip ? "line-through text-white/40" : ""}>
                R$ {Number(product.price).toFixed(2).replace(".", ",")}
              </span>
            </div>
            {isVip && (
              <div className="flex justify-between text-sm text-primary">
                <span>Desconto Sócio do Clube (-80%)</span>
                <span>−R$ {(Number(product.price) - finalPrice).toFixed(2).replace(".", ",")}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-white/10">
              <span>Total</span>
              <span>R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 text-xs text-white/50">
            <ShieldCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p>Pagamento processado com criptografia. Seus dados de cartão não passam pelos nossos servidores.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PixDisplay({ pix, amount }: { pix: PixData; amount: number }) {
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
        <p className="text-xs text-black/50 text-center">
          Após pagar, esta tela libera o acesso automaticamente.
        </p>
      </div>
    </div>
  );
}
