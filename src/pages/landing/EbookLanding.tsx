import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import {
  Loader2,
  ShoppingCart,
  CheckCircle2,
  ShieldCheck,
  Crown,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useEbookBySlug } from '@/hooks/useEbooks';
import { useUserEbooks } from '@/hooks/useUserEbooks';
import { useAuth } from '@/contexts/AuthContext';
import {
  VIP_DISCOUNT_PERCENT,
  applyVipDiscount,
  formatBRL,
} from '@/lib/vipDiscount';
import { EBOOK_CONTENT } from './ebookContent';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

const EbookLanding: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data: ebook, isLoading } = useEbookBySlug(slug ?? '');
  const { data: userPlan } = useUserPlan();
  const { data: ownedEbookIds } = useUserEbooks();
  const isVip = !!userPlan?.isVip;
  const isOwned = !!ebook && (ownedEbookIds ?? []).includes(ebook.id);

  // Toast pós-checkout
  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      toast({
        title: 'Compra realizada com sucesso! 🎉',
        description: 'Seu e-book já está disponível em "Meus E-books".',
      });
    } else if (status === 'cancel') {
      toast({
        title: 'Compra cancelada',
        description: 'Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ebook) {
    return <Navigate to="/login" replace />;
  }

  const content = EBOOK_CONTENT[slug ?? ''];

  const basePrice = ebook.price ? Number(ebook.price) : 0;
  const finalPrice = isVip ? applyVipDiscount(basePrice) : basePrice;
  const installments = basePrice > 0 ? (finalPrice / 12).toFixed(2).replace('.', ',') : '0,00';

  const handleBuy = async () => {
    if (isOwned) {
      window.location.href = '/app/ebooks';
      return;
    }
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-product-checkout',
        { body: { product_type: 'ebook', slug } },
      );
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || 'Não foi possível iniciar o checkout');
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao iniciar compra',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const scrollToOffer = () => {
    document.getElementById('oferta')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Conteúdo enriquecido com fallback para dados do banco
  const tagline = content?.tagline ?? 'Material exclusivo Drinkeros';
  const heroSubtitle = content?.hero_subtitle ?? ebook.description ?? '';
  const longDescription = content?.long_description ?? (ebook.description ? [ebook.description] : []);
  const whatYouLearn = content?.what_you_learn ?? [];
  const sections = content?.sections ?? [];
  const whoIsFor = content?.who_is_for ?? [];
  const guaranteeText =
    content?.guarantee_text ??
    '7 dias de garantia incondicional. Não curtiu? Devolvemos seu dinheiro, sem perguntas.';
  const ctaText = content?.cta_text ?? 'Quero esse e-book agora';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-serif">
      {/* CSS específico — estilo dark/vintage com ornamentos */}
      <style>{`
        @keyframes ebGoldShimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .eb-vintage-bg {
          background:
            radial-gradient(ellipse at top, rgba(80, 30, 30, 0.35), transparent 60%),
            radial-gradient(ellipse at bottom, rgba(40, 20, 10, 0.4), transparent 60%),
            #0a0a0a;
        }
        .eb-gold-text {
          background: linear-gradient(90deg, #f5e6b8 0%, #d4af37 25%, #fff5cc 50%, #d4af37 75%, #f5e6b8 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: ebGoldShimmer 6s ease-in-out infinite;
        }
        .eb-ornament-frame {
          position: relative;
          border: 1px solid rgba(212, 175, 55, 0.25);
          box-shadow:
            inset 0 0 0 1px rgba(212, 175, 55, 0.08),
            0 0 60px rgba(212, 175, 55, 0.05);
        }
        .eb-ornament-frame::before,
        .eb-ornament-frame::after {
          content: '❦';
          position: absolute;
          color: rgba(212, 175, 55, 0.55);
          font-size: 1.5rem;
          line-height: 1;
        }
        .eb-ornament-frame::before { top: -0.7rem; left: 50%; transform: translateX(-50%); background: #0a0a0a; padding: 0 0.75rem; }
        .eb-ornament-frame::after  { bottom: -0.7rem; left: 50%; transform: translateX(-50%); background: #0a0a0a; padding: 0 0.75rem; }
        .eb-divider {
          display: flex; align-items: center; gap: 1rem; color: rgba(212, 175, 55, 0.7);
        }
        .eb-divider::before, .eb-divider::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.5), transparent);
        }
      `}</style>

      {/* Top nav minimalista */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 h-14 flex items-center justify-center">
          <Link to="/app" className="flex items-center">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-7 w-auto" />
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="eb-vintage-bg relative">
        <div className="container mx-auto px-4 py-12 sm:py-20">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
            {/* Capa */}
            <div className="order-1 md:order-1 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-amber-500/20 via-amber-700/10 to-transparent blur-2xl rounded-2xl" />
                {ebook.cover_image_url ? (
                  <img
                    src={ebook.cover_image_url}
                    alt={ebook.name}
                    className="relative w-[80vw] max-w-[80vw] sm:w-full sm:max-w-sm rounded-lg shadow-[0_25px_80px_rgba(0,0,0,0.8)] ring-1 ring-amber-500/20"
                  />
                ) : (
                  <div className="relative w-[80vw] max-w-[80vw] sm:w-full sm:max-w-sm aspect-[3/4] rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center ring-1 ring-amber-500/20">
                    <BookOpen className="h-24 w-24 text-amber-500/40" />
                  </div>
                )}
                {content?.pages_count && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-600 text-black text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                    {content.pages_count} páginas
                  </div>
                )}
              </div>
            </div>

            {/* Texto */}
            <div className="order-2 md:order-2 text-center md:text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80 mb-4">
                E-book Digital · Acesso imediato
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-5 eb-gold-text">
                {ebook.name}
              </h1>
              <p className="text-lg sm:text-xl text-white/80 italic mb-6">{tagline}</p>
              <p className="text-base sm:text-lg text-white/70 leading-relaxed mb-8">
                {heroSubtitle}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-start justify-center md:justify-start">
                <button
                  onClick={scrollToOffer}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-bold px-8 py-4 text-base shadow-[0_10px_30px_rgba(212,175,55,0.4)] hover:shadow-[0_14px_40px_rgba(212,175,55,0.6)] hover:scale-[1.03] transition-all"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Quero meu e-book
                </button>
                {basePrice > 0 && (
                  <div className="text-sm text-white/60 sm:pt-1">
                    a partir de <span className="text-amber-300 font-bold">{formatBRL(finalPrice)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DESCRIÇÃO LONGA */}
      {longDescription.length > 0 && (
        <section className="py-16 sm:py-20 bg-[#0a0a0a]">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="eb-divider mb-10">
              <span className="text-xs uppercase tracking-[0.4em]">Sobre o e-book</span>
            </div>
            <div className="space-y-5 text-lg text-white/85 leading-relaxed">
              {longDescription.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* O QUE VOCÊ VAI APRENDER */}
      {whatYouLearn.length > 0 && (
        <section className="py-16 sm:py-20 bg-gradient-to-b from-[#0a0a0a] to-[#120c08]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3 eb-gold-text">
              O que você vai dominar
            </h2>
            <p className="text-center text-white/60 mb-12">
              Tudo num único PDF, lindamente diagramado, pronto pra consulta
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {whatYouLearn.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-5 rounded-lg bg-black/40 ring-1 ring-amber-500/10 hover:ring-amber-500/30 transition"
                >
                  <CheckCircle2 className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/85">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SEÇÕES DETALHADAS (capítulos) */}
      {sections.length > 0 && (
        <section className="py-16 sm:py-20 bg-[#0a0a0a]">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3 eb-gold-text">
              O que tem dentro
            </h2>
            <p className="text-center text-white/60 mb-12">Os capítulos do guia</p>
            <div className="space-y-6">
              {sections.map((section, i) => (
                <div
                  key={i}
                  className="eb-ornament-frame rounded-xl p-6 sm:p-8 bg-black/40"
                >
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-amber-400/60 font-bold text-sm">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold text-amber-100">
                      {section.title}
                    </h3>
                  </div>
                  <p className="text-white/75 leading-relaxed mb-4">
                    {section.description}
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/60">
                    {section.items.map((it, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <span className="text-amber-500/60 mt-1">•</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PARA QUEM É */}
      {whoIsFor.length > 0 && (
        <section className="py-16 sm:py-20 bg-gradient-to-b from-[#120c08] to-[#0a0a0a]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10 eb-gold-text">
              Esse e-book é pra você se…
            </h2>
            <ul className="space-y-3">
              {whoIsFor.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-lg bg-black/40 ring-1 ring-amber-500/10"
                >
                  <Sparkles className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/85">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* OFERTA */}
      <section id="oferta" className="py-16 sm:py-24 bg-[#0a0a0a]">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="eb-ornament-frame rounded-2xl p-8 sm:p-12 bg-gradient-to-b from-black/80 to-zinc-950/80 text-center">
            {isVip && basePrice > 0 && (
              <div className="inline-flex items-center gap-1.5 mb-4 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 shadow-lg">
                <Crown className="h-3.5 w-3.5" />
                Sócio do Clube · {VIP_DISCOUNT_PERCENT}% OFF
              </div>
            )}

            <p className="text-xs uppercase tracking-[0.3em] text-amber-300/70 mb-3">
              Oferta especial
            </p>
            <h3 className="text-3xl sm:text-4xl font-bold mb-2 eb-gold-text">
              {ebook.name}
            </h3>
            <p className="text-white/60 mb-8">
              Acesso imediato · Download em PDF · Leia no celular, tablet ou computador
            </p>

            {basePrice > 0 ? (
              <div className="mb-6">
                {isVip && (
                  <div className="text-white/40 line-through text-lg mb-1">
                    De {formatBRL(basePrice)}
                  </div>
                )}
                <div className="text-sm text-white/60 mb-1">por apenas</div>
                <div className="text-5xl sm:text-6xl font-extrabold eb-gold-text leading-none">
                  {formatBRL(finalPrice)}
                </div>
                <div className="text-sm text-white/60 mt-2">
                  ou 12x de R$ {installments} no cartão
                </div>
                {isVip && (
                  <p className="mt-3 text-sm text-fuchsia-300">
                    💜 Você é Sócio do Clube — esse preço é exclusivo seu
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-6 text-2xl text-white/70">Em breve</div>
            )}

            <button
              onClick={handleBuy}
              disabled={checkoutLoading || basePrice <= 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-extrabold px-8 py-5 text-lg shadow-[0_15px_40px_rgba(212,175,55,0.45)] hover:shadow-[0_20px_55px_rgba(212,175,55,0.65)] hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isOwned ? (
                <>
                  <BookOpen className="h-5 w-5" />
                  Abrir e-book
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  {ctaText}
                </>
              )}
            </button>

            {!user && (
              <p className="mt-4 text-xs text-white/50">
                Já tem conta?{' '}
                <Link to="/login" className="text-amber-300 hover:underline">
                  Entrar
                </Link>{' '}
                — Sócios do Clube ganham {VIP_DISCOUNT_PERCENT}% OFF automaticamente.
              </p>
            )}

            {/* Garantia */}
            <div className="mt-8 pt-8 border-t border-white/10 flex items-start gap-3 text-left">
              <ShieldCheck className="h-8 w-8 text-amber-400 flex-shrink-0" />
              <div>
                <div className="font-bold text-amber-100 mb-1">Garantia de 7 dias</div>
                <p className="text-sm text-white/65">{guaranteeText}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5 bg-black text-center text-xs text-white/40">
        <p>© {new Date().getFullYear()} Drinkeros. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default EbookLanding;
