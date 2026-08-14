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
import drinkerosFooterLogo from '@/assets/logotipo-drinkeros.png';
import { useCourseBySlug } from '@/hooks/useCourses';
import { useComboBySlug } from '@/hooks/useCombos';
import { applyVipDiscountFor, formatBRL, getVipPriceFor } from '@/lib/vipDiscount';
import { useVipDiscount } from '@/hooks/useVipDiscount';
import { VipDiscountCountdownBanner } from '@/components/user/VipDiscountCountdownBanner';
import AnimatedStudentCount from '@/components/landing/AnimatedStudentCount';
import VipFloatingBanner from '@/components/landing/VipFloatingBanner';
import SeoHead from '@/components/SeoHead';
import { useTotalStudents, TOTAL_STUDENTS_FALLBACK } from '@/hooks/useTotalStudents';
import PriceGiftReveal from '@/components/landing/PriceGiftReveal';
import OfferCountdownBar from '@/components/landing/OfferCountdownBar';


/** Total padrão (fallback) — fonte real é o RPC `get_total_students_certified`. */
export const TOTAL_STUDENTS_CERTIFIED = TOTAL_STUDENTS_FALLBACK;

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
  heroBadgeClassName?: string;
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

  /** Imagem extra (PNG transparente) que aparece atrás do logo no hero,
   * deslocada para a direita — ex.: cutout do professor "saindo" do logo. */
  heroOverlayImageSrc?: string;
  /** Classe Tailwind extra para o overlay (posição/tamanho). */
  heroOverlayClassName?: string;
  /** Sobrescreve a rota de checkout. Default: `/checkout/course/${slug}`. */
  checkoutPath?: string;
  /** Oculta o banner flutuante de oferta do Clube (útil quando o produto já inclui o Clube). */
  hideVipBanner?: boolean;
  /** Desabilita o desconto VIP nesta oferta (preço cheio para todos, inclusive sócios). */
  disableVipDiscount?: boolean;
  /** Preço "oficial" exibido antes da revelação do presente (ex.: 497).
   *  Quando o usuário chega na área de preço, abre o overlay do presente e,
   *  ao pegar o desconto, o valor desce animado até o preço real. */
  giftOfficialPrice?: number;
  giftTitle?: string;
  giftSubtitle?: string;
  /** Pede nome + e-mail no presente antes de liberar o desconto (funil de 2ª oferta). */
  leadCapture?: boolean;
  /** Minutos da tarja rosa de contagem regressiva exibida após o desconto. */
  offerCountdownMinutes?: number;
  /** Chave do funil (page_key) para métricas em /admin/funis. Ex.: 'rand'. */
  funnelPageKey?: string;

}


const CourseLanding: React.FC<CourseLandingProps> = ({
  slug,
  brand,
  tagline,
  subheadline,
  heroBadge,
  heroBadgeClassName,
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
  heroOverlayImageSrc,
  heroOverlayClassName,
  checkoutPath,
  hideVipBanner = false,
  disableVipDiscount = false,
  giftOfficialPrice,
  giftTitle,
  giftSubtitle,
  funnelPageKey,
  leadCapture = false,
  offerCountdownMinutes = 15,


}) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: course } = useCourseBySlug(slug);
  const { data: combo } = useComboBySlug(slug);
  const { data: userPlan } = useUserPlan();
  const isVip = !disableVipDiscount && !!userPlan?.isVip;

  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      toast({
        title: 'Compra realizada com sucesso! 🎉',
        description: 'Acesse seu e-mail para ativar sua conta e começar.',
      });
      import('@/lib/firePurchaseFromBackend').then(m => m.firePurchaseFromBackend({ source: 'course-landing' }));
      // A etapa "Comprou" do funil NÃO é registrada aqui: a URL de sucesso pode
      // ser aberta por robôs/testes. A contagem vem das vendas aprovadas no banco.

    } else if (status === 'cancel') {
      toast({
        title: 'Compra cancelada',
        description: 'Você pode tentar novamente quando quiser.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast, funnelPageKey]);

  // Funil: pageview
  useEffect(() => {
    if (!funnelPageKey) return;
    import('@/lib/funnelTracking').then(m => m.trackFunnel(funnelPageKey, 'pageview'));
  }, [funnelPageKey]);

  // Hero video: starts muted (autoplay policy), unmute on first user interaction
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroIframeRef = useRef<HTMLIFrameElement | null>(null);
  const muteVideo = useRef(() => {
    const v = heroVideoRef.current;
    if (v) {
      v.muted = true;
    }
    const iframe = heroIframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
    }
  }).current;
  const unmuteVideo = useRef(() => {
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
  }).current;
  useEffect(() => {
    if (!heroVideoUrl) return;
    let unmuted = false;
    const unmute = () => {
      if (unmuted) return;
      unmuted = true;
      unmuteVideo();
      cleanup();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
    const cleanup = () => events.forEach(e => window.removeEventListener(e, unmute));
    events.forEach(e => window.addEventListener(e, unmute, { passive: true, once: false }));
    return cleanup;
  }, [heroVideoUrl, unmuteVideo]);

  // Ao chegar na seção de preços, deixa o som do vídeo do hero mudo novamente
  useEffect(() => {
    if (!heroVideoUrl) return;
    const el = priceAnchorRef.current;
    if (!el) return;
    let didMute = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !didMute) {
          didMute = true;
          muteVideo();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [heroVideoUrl, muteVideo]);


  const dbPrice = (course as any)?.price ? Number((course as any).price) : (combo as any)?.price ? Number((combo as any).price) : null;
  const basePrice = dbPrice ?? fallbackPrice;
  const vip = useVipDiscount();
  const { data: totalStudents } = useTotalStudents();

  /* ===== Cupom da segunda oferta (link do e-mail: ?c=token) ===== */
  const couponTokenParam = searchParams.get('c');
  const [coupon, setCoupon] = useState<
    { token: string; price: number; previousPrice: number; name?: string; email?: string } | null
  >(null);

  useEffect(() => {
    const token = (couponTokenParam || '').trim();
    if (!token || !funnelPageKey) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('validate-offer-coupon', {
          body: { token },
        });
        if (cancelled || error) return;
        if (data?.valid && data?.page_key === funnelPageKey) {
          setCoupon({
            token,
            price: Number(data.price),
            previousPrice: Number(data.previous_price),
            name: data.name || undefined,
            email: data.email || undefined,
          });
          try {
            sessionStorage.setItem(`offer-coupon:${slug}`, token);
          } catch { /* ignore */ }
          import('@/lib/funnelTracking').then((m) =>
            m.trackFunnel(funnelPageKey, 'offer_2_revealed', {
              amountCents: Math.round(Number(data.price) * 100),
            }),
          );
        }

      } catch { /* cupom inválido não quebra a página */ }
    })();
    return () => { cancelled = true; };
  }, [couponTokenParam, funnelPageKey, slug]);

  const vipFinalPrice = isVip ? getVipPriceFor(slug, basePrice, vip.percent) : basePrice;
  const finalPrice = coupon ? Math.min(coupon.price, vipFinalPrice) : vipFinalPrice;

  // Parcelamento com juros do cliente (Mercado Pago: 4,49% a.m. compostos)
  const INSTALLMENT_RATE = 0.0449;
  const INSTALLMENT_COUNT = 12;
  const installmentValue =
    (finalPrice * INSTALLMENT_RATE * Math.pow(1 + INSTALLMENT_RATE, INSTALLMENT_COUNT)) /
    (Math.pow(1 + INSTALLMENT_RATE, INSTALLMENT_COUNT) - 1);
  const installments = installmentValue.toFixed(2).replace('.', ',');

  /* ===== Presente de desconto (preço oficial → preço real animado) ===== */
  const giftEnabled = !!giftOfficialPrice && giftOfficialPrice > finalPrice && !isVip && !coupon;
  const giftStorageKey = `gift-reveal:${slug}`;
  const [giftRevealed, setGiftRevealed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(`gift-reveal:${slug}`) === '1';
    } catch {
      return false;
    }
  });
  const [giftOpen, setGiftOpen] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [pricePulsing, setPricePulsing] = useState(() => {
    // Se já revelou nesta sessão, o preço final já está em vigor desde o início
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(`gift-reveal:${slug}`) === '1';
    } catch {
      return false;
    }
  });
  const priceAnchorRef = useRef<HTMLDivElement | null>(null);
  const giftSeenRef = useRef(false);

  // Abre o presente quando a área de preço entra na tela (com 1s de delay)
  useEffect(() => {
    if (!giftEnabled || giftRevealed) return;
    const el = priceAnchorRef.current;
    if (!el) return;
    let delayTimer: number | undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !giftSeenRef.current) {
          giftSeenRef.current = true;
          obs.disconnect();
          // Delay de 1 segundo antes de mostrar a oferta
          delayTimer = window.setTimeout(() => setGiftOpen(true), 1000);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (delayTimer) window.clearTimeout(delayTimer);
    };
  }, [giftEnabled, giftRevealed]);

  const markRevealed = () => {
    try {
      sessionStorage.setItem(giftStorageKey, '1');
    } catch {
      /* ignore */
    }
    setGiftRevealed(true);
  };

  const scrollToPriceAnchor = () => {
    priceAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const runPriceCountdown = (fromValue?: number, toValue?: number) => {
    const from = fromValue ?? giftOfficialPrice;
    const to = toValue ?? finalPrice;
    if (from === undefined || from === null) return;
    const duration = 1800;
    const start = performance.now();
    setDisplayPrice(from);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPrice(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
      else {
        setDisplayPrice(to);
        setPricePulsing(true);
        // Mostra a tarja pink somente quando o preço chegar no primeiro desconto (R$ 297)
        const firstTarget = coupon ? coupon.previousPrice : finalPrice;
        if (Math.abs(to - firstTarget) < 0.5) {
          setCountdownBarVisible(true);
        }
      }
    };
    requestAnimationFrame(step);
  };

  const trackGiftFunnel = () => {
    if (!funnelPageKey) return;
    import('@/lib/funnelTracking').then(m =>
      m.trackFunnel(funnelPageKey, 'offer_1_revealed', { amountCents: Math.round(finalPrice * 100) }),
    );
  };

  /* ===== Tarja de contagem regressiva da oferta ===== */
  const countdownKey = `offer-countdown:${slug}`;
  const [countdownStartedAt, setCountdownStartedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(`offer-countdown:${slug}`);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  });
  const [countdownBarVisible, setCountdownBarVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      // Se já havia revelado o desconto e a contagem está ativa, mantém a tarja visível
      return sessionStorage.getItem(`gift-reveal:${slug}`) === '1' && !!sessionStorage.getItem(`offer-countdown:${slug}`);
    } catch {
      return false;
    }
  });
  const startCountdown = () => {
    setCountdownStartedAt((prev) => {
      if (prev) return prev;
      const now = Date.now();
      try { sessionStorage.setItem(countdownKey, String(now)); } catch { /* ignore */ }
      return now;
    });
  };

  /* ===== Captura de lead (nome + e-mail) antes do desconto ===== */
  const [leadDefaults, setLeadDefaults] = useState<{ name: string; email: string }>({ name: '', email: '' });
  useEffect(() => {
    if (!leadCapture) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      setLeadDefaults({
        name: String((data.user.user_metadata as any)?.full_name || ''),
        email: data.user.email || '',
      });
    })();
    return () => { cancelled = true; };
  }, [leadCapture]);

  const handleLeadSubmit = async ({ name, email }: { name: string; email: string }) => {
    if (!funnelPageKey) return;
    await supabase.functions.invoke('capture-offer-lead', {
      body: { page_key: funnelPageKey, name, email },
    });
  };

  const handleGiftReveal = () => {
    // Trava o valor no preço oficial ANTES de marcar como revelado,
    // para o preço final (ex.: 297) nunca piscar antes da animação.
    if (giftOfficialPrice) setDisplayPrice(giftOfficialPrice);
    setPricePulsing(false);
    setGiftOpen(false);
    markRevealed();
    trackGiftFunnel();
    startCountdown();
    // Scroll até o valor e depois dispara a animação de descer o número
    scrollToPriceAnchor();
    window.setTimeout(() => runPriceCountdown(), 700);
  };


  const handleGiftClose = () => {
    setGiftOpen(false);
    markRevealed();
    trackGiftFunnel();
    setDisplayPrice(null);
    setPricePulsing(true);
    startCountdown();
    // Mesmo fechando, rola até o valor
    scrollToPriceAnchor();
  };

  /* ===== Segunda animação: 297 → 197 quando o cupom do e-mail é válido ===== */
  const couponAnimatedRef = useRef(false);
  useEffect(() => {
    if (!coupon || couponAnimatedRef.current) return;
    couponAnimatedRef.current = true;
    setPricePulsing(false);
    setDisplayPrice(coupon.previousPrice);
    setCountdownBarVisible(true);
    startCountdown();
    const t = window.setTimeout(() => {
      scrollToPriceAnchor();
      window.setTimeout(() => runPriceCountdown(coupon.previousPrice, coupon.price), 700);
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon]);

  // Preço exibido na seção de oferta
  const shownPrice = coupon
    ? displayPrice ?? coupon.previousPrice
    : giftEnabled && !giftRevealed
    ? (giftOfficialPrice as number)
    : displayPrice ?? finalPrice;

  // CTA verde animado só depois que o valor chegou no preço final
  const ctaGreenClass = giftEnabled && !pricePulsing ? 'cl-cta-green-dark' : 'cl-cta-green';
  // Gradiente verde para o preço final (R$297) após o desconto
  const priceGradient = pricePulsing
    ? 'linear-gradient(90deg, #a3e635, #22c55e, #15803d)'
    : `linear-gradient(90deg, ${theme.accent}, ${theme.primary}, ${theme.secondary})`;
  const shownInstallments = (
    (shownPrice * INSTALLMENT_RATE * Math.pow(1 + INSTALLMENT_RATE, INSTALLMENT_COUNT)) /
    (Math.pow(1 + INSTALLMENT_RATE, INSTALLMENT_COUNT) - 1)
  )
    .toFixed(2)
    .replace('.', ',');



  const handleBuy = async () => {
    setCheckoutLoading(true);
    if (funnelPageKey) {
      // Aguarda (com teto de 1.5s) para o evento não se perder na navegação.
      try {
        const m = await import('@/lib/funnelTracking');
        await Promise.race([
          m.trackFunnelAsync(funnelPageKey, 'checkout_1_started', {
            amountCents: Math.round(shownPrice * 100),
          }),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      } catch {
        /* nunca bloqueia a compra */
      }
    }
    try {
      const target = checkoutPath ?? `/checkout/course/${slug}`;
      const token = coupon?.token || (() => {
        try { return sessionStorage.getItem(`offer-coupon:${slug}`) || ''; } catch { return ''; }
      })();
      window.location.href = token
        ? `${target}${target.includes('?') ? '&' : '?'}c=${encodeURIComponent(token)}`
        : target;
      return;

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
      animation: clAuroraDrift 10s ease-in-out 1 both;
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
      animation: clGlowPulse 3.2s ease-in-out 3 both;
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
      animation: clLiquidFlow 8s ease-in-out 1 both;
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
      animation: clLiquidFlow 8s ease-in-out infinite;
    }

    /* CTA verde escuro, sem animação (antes de pegar o desconto) */
    .cl-cta-green-dark {
      background: linear-gradient(90deg, #14532d, #166534, #14532d);
      animation: none !important;
      box-shadow: 0 8px 24px rgba(20,83,45,0.45);
    }
    .cl-cta-green-dark .cl-cta-liquid {
      background: linear-gradient(90deg, #14532d, #166534, #14532d);
      animation: none !important;
      opacity: 0.9;
    }

    /* Preço pulsante após a revelação do desconto */
    @keyframes clPricePulse {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
      50% { transform: scale(1.08); filter: drop-shadow(0 0 18px rgba(132,204,22,0.55)); }
    }
    .cl-price-pulse {
      display: inline-block;
      animation: clPricePulse 1.4s ease-in-out 7 both;
      will-change: transform;
    }
  `;


  const isYoutube = heroVideoUrl?.includes('youtube.com') || heroVideoUrl?.includes('youtu.be');
  const guarantee =
    guaranteeText ??
    `Se em até ${guaranteeDays} dias você não ficar satisfeito com o curso, nos mande um e-mail e iremos te reembolsar completamente. Sem enganação e sem enrolação — garantia 100%.`;

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white overflow-x-hidden">
      <VipDiscountCountdownBanner forceShowOnProduct />
      <SeoHead
        title={`${brand} — ${tagline.length > 80 ? tagline.slice(0, 77) + '...' : tagline}`}
        description={(subheadline || tagline).slice(0, 160)}
        path={`/${slug}`}
        type="product"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: brand,
            description: subheadline || tagline,
            provider: { '@type': 'Organization', name: 'Drinkeros', url: 'https://drinkeros.com' },
            offers: {
              '@type': 'Offer',
              price: String(finalPrice),
              priceCurrency: 'BRL',
              url: `https://drinkeros.com/${slug}`,
              availability: 'https://schema.org/InStock',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]}
      />
      <h1 className="sr-only">{brand} — {tagline}</h1>
      <style>{themeStyles}</style>

      {!isVip && !hideVipBanner && (
        <VipFloatingBanner
          watchTargetId="cl-matricule-cta"
          basePrice={basePrice}
          slug={slug}
          productName={brand}
          delayMs={5000}
        />
      )}

      {/* HERO */}
      <section className="relative cl-aurora min-h-screen flex items-start">
        <div className={`container mx-auto px-4 pb-6 sm:pb-10 text-center relative z-10 ${logoBgSrc ? 'pt-0' : 'pt-8 sm:pt-12'}`}>
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
              <div className={`relative mx-auto w-fit ${logoWrapperClassName ?? 'mb-3'}`}>
                <div
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full pointer-events-none -z-10"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0) 75%)',
                  }}
                />
                {heroOverlayImageSrc && (
                  <img
                    src={heroOverlayImageSrc}
                    alt=""
                    aria-hidden
                    className={
                      heroOverlayClassName ??
                      'pointer-events-none select-none absolute z-0 left-[58%] sm:left-[60%] top-1/2 -translate-y-1/2 h-[110%] sm:h-[120%] w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]'
                    }
                  />
                )}
                <img
                  src={logoSrc}
                  alt={brand}
                  className={`relative z-10 w-auto object-contain drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${logoClassName ?? 'h-20 sm:h-28'}`}
                />
              </div>
            )
          ) : null}
          {heroBadge && (
            <p className={`text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mb-2 ${heroBadgeClassName ?? 'text-white/70'}`}>
              {heroBadge}
            </p>
          )}
          {!logoSrc && (
            <h1
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight mb-3 leading-[1.05] max-w-4xl mx-auto bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})`,
              }}
            >
              {brand}
            </h1>
          )}
          <p className={`text-lg sm:text-2xl font-bold mb-1 max-w-3xl mx-auto leading-tight ${taglineClassName ?? 'text-white'}`}>
            {tagline}
          </p>
          {!subheadlineBelowVideo && (
            <p className="text-sm sm:text-base text-white/80 mb-3 max-w-3xl mx-auto leading-snug">
              {subheadline}
            </p>
          )}

          {heroVideoUrl && (
            <div className={`w-[70%] sm:w-full ${heroVideoAspect === 'square' ? 'max-w-md aspect-square' : 'max-w-xl aspect-video'} mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-3 bg-black`}>
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
            <p className="text-sm sm:text-base text-white/80 mb-3 max-w-3xl mx-auto leading-snug">
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
            <AnimatedStudentCount target={totalStudents ?? TOTAL_STUDENTS_CERTIFIED} />
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
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${bonus.length === 3 ? 'lg:grid-cols-3 max-w-6xl' : 'max-w-5xl'} gap-6 mx-auto`}>
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
                    alt={t.alt ?? `Depoimento de aluno do curso ${brand} nº ${i + 1}`}
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
            <h2 className={`text-3xl sm:text-4xl font-extrabold text-center mb-3${titleFontClassName ? ` ${titleFontClassName}` : ""}`}>
              Garanta sua{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${theme.accent}, ${theme.secondary})` }}
              >
                vaga agora
              </span>
            </h2>

            {offerSummary && (
              <p className="text-center text-xs sm:text-sm text-white/75 leading-relaxed max-w-xl mx-auto mb-6 whitespace-pre-line">
                {offerSummary}
              </p>
            )}

            <div className="text-center mb-6" ref={priceAnchorRef}>
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
                      Preço exclusivo Sócio do Clube · {vip.percent}% OFF
                      {vip.isIntroActive && vip.hoursRemaining > 0 && (
                        <> · {vip.hoursRemaining <= 24 ? 'expira HOJE!' : `expira em ${vip.daysRemaining} ${vip.daysRemaining === 1 ? 'dia' : 'dias'}`}</>
                      )}
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
                    Esse valor especial é só para você que já é Sócio do Clube. 💜
                  </p>
                </>
              ) : (
                <>
                  {oldPriceLabel && (
                    <p className="text-lg text-white/60 line-through">{oldPriceLabel}</p>
                  )}
                  <p className="text-sm uppercase tracking-wider text-white/70 mt-2">por apenas</p>
                  <p
                    className={`text-5xl sm:text-6xl font-black bg-clip-text text-transparent my-2${pricePulsing ? ' cl-price-pulse' : ''}`}
                    style={{
                      backgroundImage: priceGradient,
                    }}
                  >
                    {formatBRL(shownPrice)}
                  </p>
                  <p className="text-base text-white/80">
                    em até <strong style={{ color: theme.accent }}>12x R$ {shownInstallments}</strong>
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
                className={`cl-cta ${ctaGreenClass} group relative inline-flex items-center justify-center gap-3 rounded-full px-8 sm:px-12 py-5 sm:py-6 font-extrabold text-white text-lg sm:text-xl overflow-hidden isolate transition-transform duration-300 hover:scale-[1.03] disabled:opacity-70 disabled:cursor-not-allowed`}
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
        <img src={drinkerosFooterLogo} alt="Drinkeros" className="h-8 w-auto mx-auto mb-3 opacity-70" />
        <p className="text-sm text-white/50">
          © {new Date().getFullYear()} Drinkeros — Todos os direitos reservados
        </p>
      </footer>

      {countdownStartedAt && (
        <OfferCountdownBar
          startedAt={countdownStartedAt}
          minutes={offerCountdownMinutes}
          hideOnEnd
          visible={countdownBarVisible}
        />
      )}

      {giftEnabled && (
        <PriceGiftReveal
          open={giftOpen}
          title={giftTitle}
          subtitle={giftSubtitle}
          requireLead={leadCapture}
          defaultName={leadDefaults.name}
          defaultEmail={leadDefaults.email}
          onSubmitLead={handleLeadSubmit}
          onReveal={handleGiftReveal}
          onClose={handleGiftClose}
        />
      )}

    </div>
  );
};


export default CourseLanding;
