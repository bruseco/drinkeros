import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  MessageCircle,
  Crown,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useCourseBySlug } from '@/hooks/useCourses';
import { VIP_DISCOUNT_PERCENT, applyVipDiscount, formatBRL } from '@/lib/vipDiscount';
import AnimatedStudentCount from '@/components/landing/AnimatedStudentCount';
import VipFloatingBanner from '@/components/landing/VipFloatingBanner';

/** Total padrão de alunos certificados — usado em todas as landings de curso. */
export const TOTAL_STUDENTS_CERTIFIED = 22341;

/**
 * Tema (paleta) por curso. Sempre 3 cores em HSL/HEX para gerar
 * gradientes do hero + CTA (laranja-rosa) e variantes (verde) para o checkout.
 */
export interface CourseTheme {
  primary: string;       // ex: '#a855f7'
  secondary: string;     // ex: '#ec4899'
  accent: string;        // ex: '#f59e0b'
  // Cor base do fundo escuro adicional (radiais sutis no hero/aurora)
  glow1: string;         // rgba(...) usada nos radiais do hero
  glow2: string;
  glow3: string;
}

export interface LearnItem {
  icon?: LucideIcon;
  title: string;
  description: string;
  imageSrc?: string;
}

export interface ModuleItem {
  number: string; // '01'
  title: string;
  topics: string[];
}

export interface ProfileItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface BonusItem {
  title: string;
  description: string;
  originalPrice?: string; // 'R$ 247,00'
  imageSrc?: string;      // imagem ilustrativa do bônus
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface TestimonialItem {
  src: string;
  alt?: string;
}

export interface CourseLandingProps {
  slug: string;
  brand: string;            // logo/título do curso (texto)
  tagline: string;          // headline do hero
  subheadline: string;      // texto secundário
  heroBadge?: string;       // ex: 'COM TOM OLIVEIRA'
  heroVideoUrl?: string;    // YouTube embed ou mp4
  heroVideoAspect?: 'video' | 'square';
  ctaHero: string;          // texto do botão do hero
  ctaCheckout?: string;     // texto botão final, default: 'MATRICULE-SE! ACESSO INSTANTÂNEO'
  theme: CourseTheme;

  /** Logo do curso (PNG transparente) — exibido no topo do hero. */
  logoSrc?: string;
  /** Imagem de fundo (faixa) atrás do logo no hero. */
  logoBgSrc?: string;
  /** Classe Tailwind para o tamanho do logo (sobrescreve default). */
  logoClassName?: string;
  /** Classe extra para a tagline (ex: cor customizada). */
  taglineClassName?: string;
  /** Renderiza a subheadline abaixo do vídeo (e não acima). */
  subheadlineBelowVideo?: boolean;
  /** Classe extra para o container do logo (ex: 'mb-2 -mt-4'). */
  logoWrapperClassName?: string;
  /** Classe Tailwind aplicada aos títulos de seção (h2). Ex: 'font-serif'. */
  titleFontClassName?: string;
  /** Foto do professor — exibida no hero abaixo do CTA. */
  instructorSrc?: string;
  /** Nome do professor — legenda abaixo da foto. */
  instructorName?: string;
  /** Seção dedicada ao professor (renderizada antes da Garantia). */
  aboutInstructor?: {
    name: string;
    photoSrc: string;
    title?: string;       // ex: 'Quem é o seu professor?'
    paragraphs: string[]; // textos em parágrafos
    credentials?: string[]; // bullets de formações/credenciais
  };

  fallbackPrice: number;    // preço default caso DB ainda não tenha
  oldPriceLabel?: string;   // 'De R$ 1.439,00'

  learnItems: LearnItem[];
  whatYouLearnTitle?: string;

  modules?: ModuleItem[];

  profiles?: ProfileItem[];

  bonusTitle?: string;
  bonus?: BonusItem[];

  /** Prints/depoimentos de alunos. Renderizado em grid antes da garantia. */
  testimonials?: TestimonialItem[];

  guaranteeDays?: number;
  guaranteeText?: string;

  faq: FaqItem[];

  /** Resumo curto (~4 linhas) exibido abaixo do título "Garanta sua vaga agora". */
  offerSummary?: string;

  whatsappPhone?: string; // default: 5548991601025
}

const CourseLanding: React.FC<CourseLandingProps> = ({
  slug,
  brand,
  tagline,
  subheadline,
  heroBadge,
  heroVideoUrl,
  heroVideoAspect = 'video',
  ctaHero,
  ctaCheckout = 'MATRICULE-SE! ACESSO INSTANTÂNEO',
  theme,
  fallbackPrice,
  oldPriceLabel,
  learnItems,
  whatYouLearnTitle = 'O que você vai aprender',
  modules = [],
  profiles = [],
  bonusTitle = 'Calma que ainda não acabou!',
  bonus = [],
  testimonials = [],
  guaranteeDays = 15,
  guaranteeText,
  faq,
  whatsappPhone = '5548991601025',
  logoSrc,
  logoBgSrc,
  logoClassName,
  taglineClassName,
  subheadlineBelowVideo = false,
  logoWrapperClassName,
  instructorSrc,
  instructorName,
  aboutInstructor,
  offerSummary,
  titleFontClassName = '',
}) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: course } = useCourseBySlug(slug);
  const { data: userPlan } = useUserPlan();
  const isVip = !!userPlan?.isVip;

  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      toast({
        title: 'Compra realizada com sucesso! 🎉',
        description: 'Acesse seu e-mail para ativar sua conta e começar.',
      });
    } else if (status === 'cancel') {
      toast({
        title: 'Compra cancelada',
        description: 'Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  // Hero video: starts muted (autoplay policy), unmute on first user interaction
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroIframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (!heroVideoUrl) return;
    let unmuted = false;
    const unmute = () => {
      if (unmuted) return;
      unmuted = true;
      const v = heroVideoRef.current;
      if (v) {
        v.muted = false;
        v.volume = 1;
        const p = v.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      const iframe = heroIframeRef.current;
      if (iframe?.contentWindow) {
        // YouTube IFrame API postMessage to unmute
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }
      cleanup();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
    const cleanup = () => events.forEach(e => window.removeEventListener(e, unmute));
    events.forEach(e => window.addEventListener(e, unmute, { passive: true, once: false }));
    return cleanup;
  }, [heroVideoUrl]);

  const dbPrice = (course as any)?.price ? Number((course as any).price) : null;
  const basePrice = dbPrice ?? fallbackPrice;
  const finalPrice = isVip ? applyVipDiscount(basePrice) : basePrice;
  const installments = (finalPrice / 12).toFixed(2).replace('.', ',');

  const handleBuy = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-product-checkout', {
        body: { product_type: 'course', slug },
      });
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

  const CTAButton: React.FC<{ children: React.ReactNode; size?: 'lg' | 'xl' }> = ({ children, size = 'lg' }) => (
    <button
      onClick={scrollToOffer}
      className={`cl-cta group relative inline-flex items-center justify-center gap-2 rounded-full font-extrabold text-white transition-transform duration-300 hover:scale-[1.03] overflow-hidden isolate ${
        size === 'xl' ? 'px-10 py-6 text-xl' : 'px-8 py-5 text-base sm:text-lg'
      }`}
    >
      <span className="cl-cta-liquid" aria-hidden="true" />
      <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{children}</span>
    </button>
  );

  // CSS dinâmico baseado no tema
  const themeStyles = `
    :root {
      --cl-primary: ${theme.primary};
      --cl-secondary: ${theme.secondary};
      --cl-accent: ${theme.accent};
    }
    @keyframes clAuroraDrift {
      0%   { background-position: 0% 50%, 100% 50%, 50% 0%, 0 0; }
      50%  { background-position: 100% 50%, 0% 50%, 50% 100%, 0 0; }
      100% { background-position: 0% 50%, 100% 50%, 50% 0%, 0 0; }
    }
    .cl-aurora {
      background:
        radial-gradient(60% 60% at 25% 30%, ${theme.glow1}, transparent 60%),
        radial-gradient(55% 55% at 75% 65%, ${theme.glow2}, transparent 60%),
        radial-gradient(70% 70% at 50% 100%, ${theme.glow3}, transparent 60%),
        linear-gradient(180deg, #07030a 0%, #050507 100%);
      background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
      animation: clAuroraDrift 18s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .cl-aurora { animation: none; }
      .cl-cta-liquid, .cl-cta { animation: none !important; }
    }

    @keyframes clLiquidFlow {
      0%   { background-position: 0% 50%, 50% 0%, 100% 100%, -140% 50%; }
      50%  { background-position: 100% 50%, 50% 100%, 0% 0%, 220% 50%; }
      100% { background-position: 0% 50%, 50% 0%, 100% 100%, 220% 50%; }
    }
    @keyframes clGlowPulse {
      0%, 100% {
        box-shadow:
          0 8px 30px ${theme.primary}73,
          0 0 40px ${theme.secondary}40,
          0 0 0 0 ${theme.primary}00;
      }
      50% {
        box-shadow:
          0 14px 50px ${theme.primary}b3,
          0 0 80px ${theme.secondary}8c,
          0 0 0 6px ${theme.primary}0d;
      }
    }
    .cl-cta {
      background: linear-gradient(90deg, ${theme.accent}, ${theme.primary}, ${theme.secondary});
      animation: clGlowPulse 3.2s ease-in-out infinite;
      transform: translate3d(0, 0, 0);
      will-change: transform, box-shadow;
    }
    .cl-cta-liquid {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      background:
        radial-gradient(60% 120% at 20% 40%, ${theme.accent}d9, transparent 60%),
        radial-gradient(70% 130% at 60% 70%, ${theme.secondary}c0, transparent 65%),
        radial-gradient(80% 140% at 90% 30%, ${theme.primary}d9, transparent 60%),
        linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 45%, transparent 70%);
      background-size: 220% 220%, 220% 220%, 220% 220%, 45% 100%;
      background-repeat: no-repeat;
      animation: clLiquidFlow 8s ease-in-out infinite;
      filter: saturate(1.15);
      z-index: 0;
      pointer-events: none;
      transform: translate3d(0, 0, 0);
    }

    /* CTA verde do checkout (mantemos identidade visual do Xperience) */
    .cl-cta-green {
      background: linear-gradient(90deg, #84cc16, #16a34a, #15803d);
      animation: clGlowPulseGreen 3.2s ease-in-out infinite;
    }
    @keyframes clGlowPulseGreen {
      0%, 100% {
        box-shadow:
          0 8px 30px rgba(22,163,74,0.45),
          0 0 40px rgba(132,204,22,0.25),
          0 0 0 0 rgba(22,163,74,0);
      }
      50% {
        box-shadow:
          0 14px 50px rgba(22,163,74,0.7),
          0 0 80px rgba(132,204,22,0.55),
          0 0 0 6px rgba(22,163,74,0.05);
      }
    }
    .cl-cta-green .cl-cta-liquid {
      background:
        radial-gradient(60% 120% at 20% 40%, rgba(163, 230, 53, 0.9), transparent 60%),
        radial-gradient(70% 130% at 60% 70%, rgba(34, 139, 34, 0.85), transparent 65%),
        radial-gradient(80% 140% at 90% 30%, rgba(21, 128, 61, 0.95), transparent 60%),
        linear-gradient(90deg, transparent 0%, rgba(190,242,100,0.35) 45%, transparent 70%);
      background-size: 220% 220%, 220% 220%, 220% 220%, 45% 100%;
      background-repeat: no-repeat;
    }
  `;

  const isYoutube = heroVideoUrl?.includes('youtube.com') || heroVideoUrl?.includes('youtu.be');
  const guarantee =
    guaranteeText ??
    `Se em até ${guaranteeDays} dias você não ficar satisfeito com o curso, nos mande um e-mail e iremos te reembolsar completamente. Sem enganação e sem enrolação — garantia 100%.`;

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white overflow-x-hidden">
      <style>{themeStyles}</style>

      {!isVip && (
        <VipFloatingBanner
          watchTargetId="cl-matricule-cta"
          basePrice={basePrice}
          delayMs={5000}
        />
      )}

      {/* HERO */}
      <section className="relative cl-aurora min-h-screen flex items-start">
        <div className={`container mx-auto px-4 pb-8 sm:pb-12 text-center relative z-10 ${logoBgSrc ? 'pt-0' : 'pt-10 sm:pt-14'}`}>
          {logoSrc ? (
            logoBgSrc ? (
              <div
                className="relative -mx-4 sm:-mx-8 mb-6 flex items-center justify-center py-6 sm:py-10 overflow-hidden"
                style={{
                  backgroundImage: `url(${logoBgSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'repeat-x',
                }}
              >
                <img
                  src={logoSrc}
                  alt={brand}
                  className={`relative w-auto object-contain ${logoClassName ?? 'h-20 sm:h-28'}`}
                />
              </div>
            ) : (
              <div className={`relative mx-auto w-fit ${logoWrapperClassName ?? 'mb-6'}`}>
                <div
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full pointer-events-none -z-10"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0) 75%)',
                  }}
                />
                <img
                  src={logoSrc}
                  alt={brand}
                  className={`relative w-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${logoClassName ?? 'h-20 sm:h-28'}`}
                />
              </div>
            )
          ) : null}
          {heroBadge && (
            <p className="text-xs sm:text-sm font-bold tracking-[0.3em] uppercase text-white/70 mb-4">
              {heroBadge}
            </p>
          )}
          {!logoSrc && (
            <h1
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight mb-4 leading-[1.05] max-w-4xl mx-auto bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})`,
              }}
            >
              {brand}
            </h1>
          )}
          <p className={`text-xl sm:text-2xl font-bold mb-3 max-w-3xl mx-auto leading-snug ${taglineClassName ?? 'text-white'}`}>
            {tagline}
          </p>
          {!subheadlineBelowVideo && (
            <p className="text-sm sm:text-base text-white/80 mb-6 max-w-3xl mx-auto">
              {subheadline}
            </p>
          )}

          {heroVideoUrl && (
            <div className={`w-[70%] sm:w-full ${heroVideoAspect === 'square' ? 'max-w-md aspect-square' : 'max-w-xl aspect-video'} mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-6 bg-black`}>
              {isYoutube ? (
                <iframe
                  ref={heroIframeRef}
                  src={`${heroVideoUrl}${heroVideoUrl.includes('?') ? '&' : '?'}autoplay=1&mute=1&playsinline=1&enablejsapi=1`}
                  className="w-full h-full"
                  title={brand}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  ref={heroVideoRef}
                  src={heroVideoUrl}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          {subheadlineBelowVideo && (
            <p className="text-sm sm:text-base text-white/80 mb-6 max-w-3xl mx-auto">
              {subheadline}
            </p>
          )}

          <div className="flex justify-center">
            <CTAButton size="lg">{ctaHero}</CTAButton>
          </div>

          {instructorSrc && (
            <div className="mt-12 flex flex-col items-center">
              <div
                className="rounded-full p-1"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.secondary})`,
                }}
              >
                <img
                  src={instructorSrc}
                  alt={instructorName ?? 'Instrutor'}
                  loading="lazy"
                  className="h-32 w-32 sm:h-40 sm:w-40 rounded-full object-cover bg-black"
                />
              </div>
              {instructorName && (
                <p className="mt-3 text-sm uppercase tracking-[0.2em] text-white/80">
                  com <strong className="text-white">{instructorName}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* O QUE VAI APRENDER */}
      {learnItems.length > 0 && (
        <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] via-[#150810] to-[#0b0b0d]">
          <div className="container mx-auto px-4">
            <h2 className={`text-3xl sm:text-5xl font-extrabold text-center mb-16${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              {whatYouLearnTitle}{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                no curso?
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {learnItems.map((item, i) => {
                const Icon = item.icon;
                if (item.imageSrc) {
                  return (
                    <div
                      key={i}
                      className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 transition-all duration-300 hover:scale-[1.02]"
                      style={{ boxShadow: undefined }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${theme.accent}80`;
                        e.currentTarget.style.boxShadow = `0 10px 40px ${theme.glow1}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.boxShadow = '';
                      }}
                    >
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={item.imageSrc}
                          alt={item.title}
                          loading="lazy"
                          width={1024}
                          height={576}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-5">
                        <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                        <p className="text-sm text-white/75 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className="group rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.02] p-6"
                  >
                    {Icon && (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                        style={{
                          background: `linear-gradient(135deg, ${theme.primary}40, ${theme.secondary}40)`,
                        }}
                      >
                        <Icon className="h-7 w-7" style={{ color: theme.accent }} />
                      </div>
                    )}
                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-white/75 leading-relaxed">{item.description}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center mt-12">
              <CTAButton>{ctaHero}</CTAButton>
            </div>
          </div>
        </section>
      )}

      {/* CONTAGEM DE ALUNOS */}
      <section
        className="py-12 sm:py-16"
        style={{
          backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
        }}
      >
        <div className="container mx-auto px-4 text-center text-white">
          <p className="text-lg sm:text-xl font-semibold uppercase tracking-wider opacity-90">Já certificamos</p>
          <p className="text-6xl sm:text-7xl lg:text-8xl font-black my-2 drop-shadow-lg tabular-nums">
            <AnimatedStudentCount target={TOTAL_STUDENTS_CERTIFIED} />
          </p>
          <p className="text-lg sm:text-xl font-semibold uppercase tracking-wider opacity-90">alunos até o momento</p>
        </div>
      </section>

      {/* MÓDULOS */}
      {modules.length > 0 && (
        <section className="py-16 sm:py-24 bg-[#0b0b0d]">
          <div className="container mx-auto px-4">
            <h2 className={`text-3xl sm:text-5xl font-extrabold text-center mb-12${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              Grade do{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                curso
              </span>
            </h2>
            <div className="max-w-3xl mx-auto">
              <Accordion type="multiple" className="space-y-3">
                {modules.map((m, i) => (
                  <AccordionItem
                    key={i}
                    value={`m-${i}`}
                    className="rounded-xl bg-white/5 border border-white/10 px-5"
                  >
                    <AccordionTrigger className="text-left font-semibold text-white hover:no-underline">
                      <span className="flex items-baseline gap-3">
                        <span
                          className="text-sm font-extrabold tabular-nums"
                          style={{ color: theme.accent }}
                        >
                          {m.number}
                        </span>
                        <span>{m.title}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-white/80 pt-2">
                        {m.topics.map((t, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <span style={{ color: theme.accent }} className="mt-1">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      )}

      {/* PARA QUEM É */}
      {profiles.length > 0 && (
        <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] to-[#150810]">
          <div className="container mx-auto px-4">
            <h2 className={`text-3xl sm:text-5xl font-extrabold text-center mb-16${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              Para quem é{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                esse curso?
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {profiles.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div
                    key={i}
                    className="text-center flex flex-col items-center p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 transition-all"
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                      style={{
                        background: `linear-gradient(135deg, ${theme.primary}40, ${theme.secondary}40)`,
                      }}
                    >
                      <Icon className="h-10 w-10" style={{ color: theme.accent }} />
                    </div>
                    <h3
                      className="text-xl sm:text-2xl font-extrabold mb-3 bg-clip-text text-transparent"
                      style={{
                        backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})`,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p className="text-white/80 text-base">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* BÔNUS */}
      {bonus.length > 0 && (
        <section className="py-16 sm:py-24 bg-[#0b0b0d]">
          <div className="container mx-auto px-4">
            <h2 className={`text-3xl sm:text-5xl font-extrabold text-center mb-4${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              {bonusTitle.split(' ').slice(0, -2).join(' ')}{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                {bonusTitle.split(' ').slice(-2).join(' ')}
              </span>
            </h2>
            <p className="text-center text-lg sm:text-xl text-white/80 max-w-3xl mx-auto mb-16">
              Veja os <strong style={{ color: theme.accent }}>{bonus.length} BÔNUS</strong> que você ganha ao adquirir esse curso:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {bonus.map((b, i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-white/30 transition-all hover:scale-[1.02] flex flex-col"
                >
                  {b.imageSrc && (
                    <div className="aspect-[16/10] w-full overflow-hidden bg-black/40">
                      <img
                        src={b.imageSrc}
                        alt={b.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase"
                        style={{
                          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
                        }}
                      >
                        Bônus {i + 1}
                      </div>
                      {b.originalPrice && (
                        <span className="text-xs text-white/50 line-through ml-auto pt-1">
                          {b.originalPrice}
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-lg sm:text-xl mb-2">{b.title}</h3>
                    <p className="text-sm sm:text-base text-white/75">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DEPOIMENTOS */}
      {testimonials.length > 0 && (
        <section className="py-16 sm:py-24 bg-[#0b0b0d]">
          <div className="container mx-auto px-4">
            <h2 className={`text-3xl sm:text-5xl font-extrabold text-center mb-4${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              O que dizem{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                nossos alunos
              </span>
            </h2>
            <p className="text-center text-white/70 max-w-2xl mx-auto mb-12 text-sm sm:text-base">
              Depoimentos reais de quem já transformou sua relação com a coquetelaria.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <img
                    src={t.src}
                    alt={t.alt ?? `Depoimento ${i + 1}`}
                    loading="lazy"
                    className="w-full h-auto block"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-12">
              <CTAButton>{ctaHero}</CTAButton>
            </div>
          </div>
        </section>
      )}

      {/* SOBRE O PROFESSOR */}
      {aboutInstructor && (
        <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] via-[#100712] to-[#0b0b0d]">
          <div className="container mx-auto px-4">
            <h2 className={`text-3xl sm:text-5xl font-extrabold text-center mb-12${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              {aboutInstructor.title ?? 'Quem é o seu'}{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                {aboutInstructor.title ? '' : 'professor?'}
              </span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-10 items-start max-w-5xl mx-auto">
              <div className="flex flex-col items-center lg:items-start">
                <div className="relative">
                  {/* Gradient glows behind the photo */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-16 sm:-inset-20 -z-10 blur-3xl opacity-80"
                    style={{
                      background: `radial-gradient(circle at 20% 25%, ${theme.glow1} 0%, transparent 55%), radial-gradient(circle at 80% 30%, ${theme.glow2} 0%, transparent 55%), radial-gradient(circle at 50% 85%, ${theme.glow3} 0%, transparent 60%)`,
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl opacity-70"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
                    }}
                  />
                  <div
                    className="relative rounded-3xl p-1"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
                    }}
                  >
                    <img
                      src={aboutInstructor.photoSrc}
                      alt={aboutInstructor.name}
                      loading="lazy"
                      className="h-64 w-64 sm:h-80 sm:w-80 rounded-3xl object-cover bg-black"
                    />
                  </div>
                </div>
                <p
                  className="mt-4 text-2xl font-extrabold bg-clip-text text-transparent text-center lg:text-left"
                  style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
                >
                  {aboutInstructor.name}
                </p>
              </div>
              <div className="space-y-4 text-white/85 text-base sm:text-lg leading-relaxed">
                {aboutInstructor.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {aboutInstructor.credentials && aboutInstructor.credentials.length > 0 && (
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 pt-2">
                    {aboutInstructor.credentials.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-white/90">
                        <CheckCircle2
                          className="h-5 w-5 mt-0.5 flex-shrink-0"
                          style={{ color: theme.accent }}
                        />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GARANTIA */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-[#0b0b0d] to-[#14070f]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div
              className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6"
              style={{
                background: `linear-gradient(135deg, ${theme.primary}30, ${theme.secondary}30)`,
                border: `2px solid ${theme.accent}`,
              }}
            >
              <ShieldCheck className="h-12 w-12" style={{ color: theme.accent }} />
            </div>
            <h2 className={`text-3xl sm:text-4xl font-extrabold mb-4${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              Garantia de{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                {guaranteeDays} dias
              </span>
            </h2>
            <p className="text-base sm:text-lg text-white/85 max-w-2xl mx-auto">
              {guarantee}
            </p>
          </div>
        </div>
      </section>

      {/* OFERTA */}
      <section
        id="oferta"
        className="scroll-mt-4 pt-6 pb-16 sm:pt-8 sm:pb-24 bg-gradient-to-br from-[#1a0612] via-[#0b0b0d] to-[#0a0a14]"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 shadow-2xl p-6 sm:p-10 backdrop-blur">
            <h2 className={`text-3xl sm:text-4xl font-extrabold text-center mb-6${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              Garanta sua{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                vaga agora
              </span>
            </h2>

            <div className="text-center mb-6">
              {isVip ? (
                <>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
                    style={{
                      background: `linear-gradient(90deg, ${theme.primary}33, ${theme.secondary}33)`,
                      border: `1px solid ${theme.accent}66`,
                    }}
                  >
                    <Crown className="h-4 w-4" style={{ color: theme.accent }} />
                    <span className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                      Preço exclusivo VIP · {VIP_DISCOUNT_PERCENT}% OFF
                    </span>
                  </div>
                  <p className="text-lg text-white/60 line-through">{formatBRL(basePrice)}</p>
                  <p className="text-sm uppercase tracking-wider text-white/70 mt-2">por apenas</p>
                  <p
                    className="text-5xl sm:text-6xl font-black bg-clip-text text-transparent my-2"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.primary}, ${theme.secondary})`,
                    }}
                  >
                    {formatBRL(finalPrice)}
                  </p>
                  <p className="text-base text-white/80">
                    em até{' '}
                    <strong style={{ color: theme.accent }}>
                      12x R$ {installments}
                    </strong>
                  </p>
                  <p className="text-xs mt-2" style={{ color: theme.accent }}>
                    Esse valor especial é só para você que já é assinante VIP. 💜
                  </p>
                </>
              ) : (
                <>
                  {oldPriceLabel && (
                    <p className="text-lg text-white/60 line-through">{oldPriceLabel}</p>
                  )}
                  <p className="text-sm uppercase tracking-wider text-white/70 mt-2">por apenas</p>
                  <p
                    className="text-5xl sm:text-6xl font-black bg-clip-text text-transparent my-2"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.primary}, ${theme.secondary})`,
                    }}
                  >
                    {formatBRL(finalPrice)}
                  </p>
                  <p className="text-base text-white/80">
                    em até <strong style={{ color: theme.accent }}>12x R$ {installments}</strong>
                  </p>
                </>
              )}
            </div>

            {/* Oferta VIP agora aparece como banner flutuante (VipFloatingBanner) */}

            <div className="flex justify-center mb-6">
              <button
                id="cl-matricule-cta"
                onClick={handleBuy}
                disabled={checkoutLoading}
                className="cl-cta cl-cta-green group relative inline-flex items-center justify-center gap-3 rounded-full px-8 sm:px-12 py-5 sm:py-6 font-extrabold text-white text-lg sm:text-xl overflow-hidden isolate transition-transform duration-300 hover:scale-[1.03] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="cl-cta-liquid" aria-hidden="true" />
                {checkoutLoading ? (
                  <span className="relative z-10 inline-flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                    <Loader2 className="h-6 w-6 animate-spin" /> Abrindo checkout...
                  </span>
                ) : (
                  <span className="relative z-10 inline-flex items-center gap-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                    <Check className="h-16 w-16 sm:h-20 sm:w-20" strokeWidth={3} /> {ctaCheckout}
                  </span>
                )}
              </button>
            </div>

            <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-lime-400" /> Garantia de {guaranteeDays} dias
              </span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-lime-400" /> Acesso de 1 ano
              </span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-lime-400" /> Pagamento seguro
              </span>
            </div>

            <div className="mt-8 text-center text-sm text-white/60">
              Já é aluno?{' '}
              <Link to="/login" className="underline" style={{ color: theme.accent }}>
                Acesse aqui
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] to-[#14070f]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className={`text-3xl sm:text-4xl font-extrabold text-center mb-4${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              Tire todas suas{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                dúvidas!
              </span>
            </h2>
            <p className="text-center text-white/70 mb-10">
              Caso ainda tenha alguma dúvida, fale com a gente pelo WhatsApp.
            </p>
            <Accordion type="single" collapsible className="space-y-3">
              {faq.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`q-${i}`}
                  className="rounded-xl bg-white/5 border border-white/10 px-5"
                >
                  <AccordionTrigger className="text-left font-semibold text-white hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="flex justify-center mt-12">
              <CTAButton size="xl">{ctaHero}</CTAButton>
            </div>
          </div>
        </section>
      )}

      {/* SUPORTE WHATSAPP */}
      <section className="py-16 bg-[#0b0b0d]">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">Ainda possui dúvidas?</h3>
          <p className="text-white/70 mb-6">Fale conosco imediatamente através do WhatsApp</p>
          <a
            href={`https://wa.me/${whatsappPhone}?text=Ol%C3%A1!%20Preciso%20de%20ajuda.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg transition-all hover:scale-[1.03]"
          >
            <MessageCircle className="h-5 w-5" /> Falar com o Suporte
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 bg-black text-center border-t border-white/5">
        <p className="text-sm text-white/50">
          © {new Date().getFullYear()} Drinkeros — Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
};

export default CourseLanding;
