import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, Check, X, GlassWater, Sparkles, Zap, GraduationCap, Loader2, RefreshCw, Gift, PlayCircle, Trophy, Timer, Smartphone, Lock, ShieldCheck } from 'lucide-react';
import jackDaniels from '@/assets/landing/bebida-decifrada/jack-daniels-degustacao.mp4';
import bebidaCover from '@/assets/landing/bebida-decifrada/cover.jpg';
import workshopVsl from '@/assets/landing/workshop/vsl.mp4';
import certificadoWorkshop from '@/assets/landing/certificado-workshop-classicos.png';
const workshopCover = 'https://pvjlcfhqueibjnkuzzna.supabase.co/storage/v1/object/public/package-covers/dd1da78d-6b25-49ee-8d49-8e83f675ff65.jpg';
import xaropesVideo from '@/assets/landing/xaropes/clipe-xaropes-artesanais.mov';
import xaropesCover from '@/assets/thumb-xaropes.jpg';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useHasExclusiveAccess } from '@/hooks/useExclusiveAccess';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackInitiateCheckout, waitForPixelFlush } from '@/lib/metaPixel';
import { useViewContent } from '@/hooks/useViewContent';
import TestimonialsCarousel from '@/components/landing/TestimonialsCarousel';
import { useTotalClubMembers, TOTAL_CLUB_MEMBERS_FALLBACK } from '@/hooks/useTotalClubMembers';
import { useLaunchPromo } from '@/hooks/useLaunchPromo';
import { useClubeSettings } from '@/hooks/useClubeSettings';
import { useAbVariantTrack, trackAbConversion } from '@/hooks/useAbTest';

import bgTijolos from '@/assets/bg-tijolos-pretos.jpg';
import drinksStrip from '@/assets/1000-drinks.jpg';
import payVisa from '@/assets/pagamento-visa.png';
import payMaster from '@/assets/pagamento-mastercard.png';
import payApple from '@/assets/pagamento-apple.png';
import payGoogle from '@/assets/pagamento-google.png';
import payPix from '@/assets/pagamento-pix.png';

const VideoWithPoster: React.FC<{ src: string; poster: string; alt: string }> = ({ src, poster, alt }) => {
  const [started, setStarted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const handlePlay = () => {
    setStarted(true);
    requestAnimationFrame(() => videoRef.current?.play());
  };
  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        src={src}
        controls={started}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onPlay={() => setStarted(true)}
      />
      {!started && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Reproduzir ${alt}`}
          className="absolute inset-0 group"
        >
          <img src={poster} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/40 group-hover:bg-white/60 backdrop-blur-sm shadow-2xl transition-transform group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-black/80 ml-1"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

const LaunchPromoCountdown: React.FC = () => {
  const { data: settings } = useClubeSettings();
  const { isActive, mm, ss } = useLaunchPromo({
    promoPrice: settings?.promo_price,
    fullPrice: settings?.full_price,
  });
  if (!isActive) return null;
  return (
    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-200">
      <Timer className="h-3.5 w-3.5" />
      <span className="text-yellow-100">Promoção de lançamento expira em</span>
      <span className="font-mono font-bold text-white tabular-nums">
        {mm}:{ss}
      </span>
    </div>
  );
};


const TrustLine: React.FC = () => (
  <p className="text-center text-[11px] text-purple-300 mt-2 leading-relaxed">
    ✓ Cancele quando quiser · acesso liberado imediatamente após a confirmação do pagamento · <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> pagamento seguro</span>
  </p>
);

const VipLandingB: React.FC = () => {
  useAbVariantTrack('clube', 'b');
  const { user } = useAuth();
  const { data: planData } = useUserPlan();
  const { data: totalMembers } = useTotalClubMembers();
  const memberCount = (totalMembers ?? TOTAL_CLUB_MEMBERS_FALLBACK) + 1000;
  const memberCountRounded = Math.max(100, Math.floor(memberCount / 100) * 100);
  const { data: hasExclusive } = useHasExclusiveAccess('receitas');
  const { data: hasLifetime } = useQuery({
    queryKey: ['lifetime-access-self', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_lifetime_access')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
  });
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isClosing] = useState(false);
  const { data: clubeSettings } = useClubeSettings();
  const promo = useLaunchPromo({
    promoPrice: clubeSettings?.promo_price,
    fullPrice: clubeSettings?.full_price,
  });

  useViewContent({
    key: 'clube-dos-drinkeros',
    content_name: 'Clube dos Drinkeros',
    content_category: 'clube',
    content_type: 'product',
    value: 69,
    currency: 'BRL',
  });

  useEffect(() => {
    const status = searchParams.get('vip') || searchParams.get('clube');
    if (status === 'success') {
      toast.success('🎉 Acesso desbloqueado! Bem-vindo ao Clube dos Drinkeros.');
      queryClient.invalidateQueries({ queryKey: ['user-plan'] });
      import('@/lib/firePurchaseFromBackend').then(m => m.firePurchaseFromBackend({ source: 'clube-success' }));
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    } else if (status === 'cancel') {
      toast.info('Pagamento cancelado. Quando quiser, é só voltar 💜');
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    } else if (status === 'pending') {
      toast.info('Pagamento em análise. Assim que aprovar, seu acesso será liberado.');
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const handleSubscribe = async (chosenMethod: 'card' | 'pix' = 'card') => {
    if (!user) {
      navigate('/signup?redirect=/clube');
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-club-checkout', {
        body: { method: chosenMethod },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('URL de checkout não retornada');

      trackInitiateCheckout({
        amount: data.amount,
        currency: data.currency,
        product_name: data.product_name,
        product_type: 'subscription',
        price_id: data.price_id,
        session_id: data.session_id,
      });
      trackAbConversion('clube');
      await waitForPixelFlush();

      window.location.href = data.url;
    } catch (err: any) {
      toast.error('Erro ao iniciar checkout', { description: err.message });
      setLoading(false);
    }
  };

  if (user && (planData?.isVip || hasLifetime || hasExclusive)) {
    return <Navigate to="/app/receitas" replace />;
  }

  const scrollToPricing = () =>
    document.getElementById('clube-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div
      className={`fixed inset-0 z-[60] text-white py-0 overflow-y-auto overscroll-contain bg-black ${isClosing ? 'animate-[viplanding-fade-out_280ms_ease-in_forwards]' : 'animate-[viplanding-bounce-in_520ms_cubic-bezier(0.34,1.56,0.64,1)_forwards]'}`}
      
    >
      {/* Promo top banner disabled on this variant */}
      <style>{`
        @keyframes viplanding-bounce-in {
          0% { opacity: 0; transform: scale(0.85); }
          60% { opacity: 1; transform: scale(1.04); }
          80% { transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes viplanding-fade-out {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.96); }
        }
        @keyframes viplanding-gold-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes viplanding-gold-glow {
          0%, 100% { box-shadow: 0 0 20px 0 rgba(250, 204, 21, 0.45), 0 0 40px 0 rgba(250, 204, 21, 0.25); }
          50% { box-shadow: 0 0 35px 6px rgba(250, 204, 21, 0.75), 0 0 70px 12px rgba(250, 204, 21, 0.45); }
        }
        .viplanding-gold-text {
          background-image: linear-gradient(110deg, #b8860b 0%, #fde68a 25%, #fbbf24 50%, #fde68a 75%, #b8860b 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: viplanding-gold-shimmer 4s linear infinite;
          filter: drop-shadow(0 0 14px rgba(250, 204, 21, 0.55));
        }
        .viplanding-gold-btn {
          background-image: linear-gradient(110deg, #b8860b 0%, #fde68a 25%, #fbbf24 50%, #fde68a 75%, #b8860b 100%);
          background-size: 200% auto;
          animation: viplanding-gold-shimmer 3.5s linear infinite, viplanding-gold-glow 2.4s ease-in-out infinite;
          color: #1a1206;
        }
        .viplanding-gold-btn:hover { filter: brightness(1.05); }
      `}</style>

      {/* HERO — foco em desbloquear acesso ao app */}
      <div
        className="relative"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.78) 60%, #000 100%), url(${bgTijolos})`,
          backgroundSize: '200% auto',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="relative z-30 container mx-auto max-w-3xl px-4 pt-12 pb-10 text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-yellow-300">
            <Lock className="h-3.5 w-3.5" /> Acesso ilimitado ao app Drinkeros
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-[1.05]">
            <span className="text-white">Desbloqueie </span>
            <span className="viplanding-gold-text">TODAS</span>
            <span className="text-white"> as Receitas da </span>
            <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">Drinkeros</span>
          </h1>
          <AnimatedAccessLoop />

          <p className="text-sm md:text-base text-yellow-200/90">
            Mais de <strong className="text-yellow-300">1.000 drinks</strong>, xaropes artesanais, minisséries e conteúdos exclusivos no seu bolso.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center pt-2">
            <Button
              onClick={() => handleSubscribe('card')}
              disabled={loading}
              className="viplanding-gold-btn h-12 px-6 text-sm font-bold border-0 hover:text-black"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
              ) : (
                <><Crown className="mr-2 h-5 w-5" /> Desbloquear acesso exclusivo</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById('clube-compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="h-12 px-5 text-sm font-semibold border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Ver tudo que está incluso
            </Button>
          </div>
          <TrustLine />
        </div>
      </div>

      {/* Parte inferior com degradês */}
      <div className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute top-[5%] -left-32 w-[480px] h-[480px] rounded-full bg-purple-700/30 blur-[120px]" />
          <div className="absolute top-[25%] -right-40 w-[520px] h-[520px] rounded-full bg-fuchsia-600/25 blur-[130px]" />
          <div className="absolute top-[55%] -left-24 w-[420px] h-[420px] rounded-full bg-pink-600/25 blur-[120px]" />
          <div className="absolute bottom-[5%] -right-32 w-[460px] h-[460px] rounded-full bg-purple-600/30 blur-[130px]" />
        </div>

        <div className="relative z-10 container mx-auto max-w-4xl">

          {/* COMPARAÇÃO */}
          <div id="clube-compare" className="grid grid-cols-2 gap-2 sm:gap-4 mb-10 mt-6 sm:mx-0 relative left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 w-[calc(100vw-6px)] sm:w-auto scroll-mt-6">
            {/* Grátis */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-400 text-zinc-950 px-2.5 py-1 text-xs font-bold uppercase w-fit">
                  <Sparkles className="h-3 w-3" /> Grátis
                </span>
                <span className="text-purple-300 text-xs sm:text-sm">o que você tem hoje</span>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2 text-purple-200"><Check className="h-4 w-4 text-purple-300 shrink-0 mt-0.5" /> <span><strong className="text-white">1 receita completa</strong> liberada por dia</span></li>
                <li className="flex items-start gap-2 text-purple-200"><Check className="h-4 w-4 text-purple-300 shrink-0 mt-0.5" /> <span>Navegação e filtros liberados</span></li>
                <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Acesso limitado aos conteúdos especiais</span></li>
                <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Sem participação na <strong>Batalha dos Drinkeros</strong></span></li>
                <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Cursos e ebooks vendidos separadamente</span></li>
              </ul>
            </div>

            {/* Sócio */}
            <div className="relative rounded-2xl bg-gradient-to-br from-purple-900/60 to-fuchsia-900/40 border border-purple-400/40 p-4 md:p-6 shadow-2xl shadow-purple-500/20">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-4">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase w-fit text-amber-950 shadow-[0_0_18px_rgba(250,204,21,0.55),inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-yellow-200/70"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, #b8862b 0%, #f9d976 25%, #fff4b8 50%, #f9d976 75%, #a87513 100%)',
                    backgroundSize: '200% 200%',
                  }}
                >
                  <Crown className="h-3 w-3" /> Sócio
                </span>
                <span className="text-yellow-300 text-xs sm:text-sm font-medium">o que você desbloqueia</span>
              </div>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">Acesso ilimitado</strong> a todas as receitas do app</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">Xaropes Artesanais</strong> liberados</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Acesso à minissérie <strong className="text-white">Bebida Decifrada</strong></span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">Workshop Além dos Clássicos</strong>, com certificado</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Participação na <strong className="text-white">Batalha dos Drinkeros</strong></span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">80% de desconto</strong> em produtos selecionados</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Cursos e ebooks expirados <strong className="text-white">reativados</strong> enquanto a assinatura estiver ativa</span></li>
              </ul>
              <Button
                onClick={scrollToPricing}
                className="viplanding-gold-btn w-full h-11 mt-5 text-sm font-bold border-0 hover:text-black"
              >
                <Crown className="mr-1.5 h-4 w-4" /> Desbloquear acesso ilimitado
              </Button>
            </div>
          </div>

          {/* PREÇO ANTECIPADO */}
          <div className="relative max-w-md mx-auto mb-12 px-4">
            <div className="rounded-3xl bg-gradient-to-br from-purple-900/50 to-black border border-yellow-400/30 p-6 text-center">
              <div className="text-xs uppercase tracking-widest font-bold text-yellow-300 mb-2">
                Sócio do Clube · Anual
              </div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-xl font-light text-purple-300">R$</span>
                <span className="text-6xl font-black viplanding-gold-text">{promo.price}</span>
                <span className="text-sm text-purple-300 ml-1">/ ano</span>
              </div>
              <p className="text-sm text-purple-200 mt-1">
                Equivale a menos de <strong className="text-white">R$ 17 por mês</strong>.
              </p>
              <p className="text-[11px] text-purple-300 mt-1">
                Acesso anual · renovação automática · cancele quando quiser
              </p>
              <Button
                onClick={() => handleSubscribe('card')}
                disabled={loading}
                className="viplanding-gold-btn w-full h-12 mt-4 text-sm font-bold border-0 hover:text-black"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
                ) : (
                  <><Smartphone className="mr-2 h-5 w-5" /> Quero desbloquear o App</>
                )}
              </Button>
              <TrustLine />
            </div>
          </div>

          {/* DEPOIMENTOS */}
          <div className="mb-2">
            <h3 className="text-center text-xl md:text-2xl font-black text-white mb-1">
              Quem entrou no <span className="text-yellow-300">Clube</span> recomenda
            </h3>
            <p className="text-center text-purple-200 text-sm mb-2 px-4">
              Depoimentos reais de alunos e membros que já vivem a experiência Drinkeros.
            </p>
          </div>
          <TestimonialsCarousel />

          {/* Reativação de cursos expirados */}
          <div className="relative max-w-3xl mx-auto mb-12 px-4">
            <div className="rounded-2xl bg-gradient-to-br from-yellow-400/10 to-purple-600/10 border border-yellow-400/30 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-full bg-yellow-400/20 p-3">
                  <RefreshCw className="h-6 w-6 text-yellow-300" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black mb-2">
                    Cursos expirados? <span className="text-yellow-300">Reativam na hora.</span>
                  </h3>
                  <p className="text-purple-200 text-sm md:text-base leading-snug">
                    Qualquer curso, ebook ou pacote que você já comprou e que está expirado
                    <strong className="text-white"> volta a ficar acessível</strong> assim que você desbloqueia o acesso de sócio.
                    Enquanto a assinatura estiver ativa, <strong className="text-white">tudo o que tem prazo continua liberado</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BÔNUS */}
          <div className="max-w-4xl mx-auto mb-16 px-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 border border-yellow-400/30 px-4 py-1.5 text-yellow-300 text-xs font-bold uppercase tracking-widest mb-3">
                <Gift className="h-3.5 w-3.5" />
                O que você desbloqueia
              </div>
              <h2 className="text-3xl md:text-4xl font-black">
                Saiba mais sobre <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">cada bônus</span>
              </h2>
              <p className="text-purple-200 text-sm md:text-base mt-3 max-w-2xl mx-auto">
                Além do acesso ilimitado às receitas do app, você também desbloqueia bônus exclusivos para evoluir seus drinks.
              </p>
            </div>

            <div className="space-y-10">
              {/* Card 0 — Acesso ilimitado */}
              <div className="rounded-2xl bg-gradient-to-br from-yellow-900/30 via-purple-900/30 to-black border border-yellow-400/40 overflow-hidden p-6">
                <div className="text-center max-w-xl mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Smartphone className="h-5 w-5 text-yellow-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Principal</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Acesso ilimitado ao App Drinkeros</h3>
                  <p className="text-sm text-purple-200 leading-snug">
                    Pesquise, filtre e abra <strong className="text-white">quantas receitas quiser</strong>, sem limite diário.
                    Ideal para preparar drinks em casa, em festas, encontros ou eventos.
                  </p>
                </div>
              </div>

              {/* Bônus 1 - Xaropes Artesanais */}
              <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/30 overflow-hidden p-6">
                <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                  <VideoWithPoster src={xaropesVideo} poster={xaropesCover} alt="Xaropes Artesanais" />
                </div>
                <div className="text-center max-w-xl mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <GlassWater className="h-5 w-5 text-yellow-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 1</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Xaropes Artesanais</h3>
                  <p className="text-sm text-purple-200 leading-snug">
                    São <strong className="text-white">mais de 40 receitas exclusivas</strong> de xaropes que{' '}
                    <strong className="text-white">elevam o nível dos seus drinks</strong> e ainda{' '}
                    <strong className="text-white">geram muita economia</strong> — você para de comprar xaropes industrializados caros e passa a fazer o seu, do seu jeito.
                  </p>
                </div>
              </div>

              {/* Bônus 2 - Batalha dos Drinkeros */}
              <div className="rounded-2xl bg-gradient-to-br from-yellow-900/30 to-black border border-yellow-500/30 overflow-hidden p-6">
                <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                  <VideoWithPoster src="/vinheta-batalha-dos-drinkeros-web.mp4" poster="/batalha-video-poster.jpg" alt="Batalha dos Drinkeros" />
                </div>
                <div className="text-center max-w-xl mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Trophy className="h-5 w-5 text-yellow-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 2</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Batalha dos Drinkeros</h3>
                  <p className="text-base sm:text-lg font-bold text-yellow-300 leading-snug mb-3">
                    Todo mês, o 1º do Ranking leva R$ 200 em voucher.
                  </p>
                  <p className="text-sm text-purple-200 leading-snug">
                    Toda semana, sócios do Clube competem com seus drinks autorais.
                    Os <strong className="text-white">melhores do mês</strong> ganham destaque e disputam o título de
                    <strong className="text-white"> melhor drinker do ano</strong>.
                  </p>
                  <p className="mt-3 text-sm text-purple-100 leading-snug">
                    O <strong className="text-yellow-300">1º lugar do ranking mensal</strong> ganha{' '}
                    <strong className="text-yellow-300">R$ 200 em voucher</strong> para gastar em bebidas premium no nosso parceiro{' '}
                    <a
                      href="https://www.espacoprime.com.br"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white underline underline-offset-2 hover:text-yellow-300"
                    >
                      Espaço Prime
                    </a>.
                  </p>
                </div>
              </div>

              {/* Bônus 3 - Workshop Além dos Clássicos */}
              <div className="rounded-2xl bg-gradient-to-br from-fuchsia-900/40 to-black border border-fuchsia-500/30 overflow-hidden p-6">
                <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                  <VideoWithPoster src={workshopVsl} poster={workshopCover} alt="Workshop Além dos Clássicos" />
                </div>
                <div className="text-center max-w-xl mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <GraduationCap className="h-5 w-5 text-yellow-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 3</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Workshop Além dos Clássicos</h3>
                  <p className="text-sm text-purple-200 leading-snug">
                    Você vai aprender a <strong className="text-white">história dos clássicos mais famosos do mundo</strong>,
                    entender como foram criados e aprender a{' '}
                    <strong className="text-white">criar variações</strong> mantendo a mesma estrutura.
                    Na primeira aula, você aprende os xaropes que serão utilizados nos drinks.
                  </p>
                  <p className="text-sm text-purple-100 leading-snug mt-4">
                    E ao concluir o workshop, você ainda recebe um{' '}
                    <strong className="text-white">Certificado de Conclusão exclusivo</strong>, assinado por Bruno Abreu.
                  </p>
                  <div className="mt-5 rounded-xl overflow-hidden ring-1 ring-white/10 bg-black/40">
                    <img
                      src={certificadoWorkshop}
                      alt="Modelo do Certificado de Conclusão do Workshop Além dos Clássicos"
                      loading="lazy"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* Bônus 4 - Bebida Decifrada */}
              <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/30 overflow-hidden p-6">
                <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                  <VideoWithPoster src={jackDaniels} poster={bebidaCover} alt="Bebida Decifrada" />
                </div>
                <div className="text-center max-w-xl mx-auto">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <PlayCircle className="h-5 w-5 text-yellow-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 4</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Bebida Decifrada</h3>
                  <p className="text-sm text-purple-200 leading-snug">
                    Uma minissérie onde você aprende as melhores curiosidades das bebidas mais
                    famosas do mundo, como <strong className="text-white">Jack Daniels</strong>,{' '}
                    <strong className="text-white">Tequila José Cuervo</strong>,{' '}
                    <strong className="text-white">Amarula</strong> e várias outras.
                  </p>
                  <p className="text-xs text-purple-300 mt-3 italic">▶ Acima, a degustação do Jack Daniels.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Prova social — total */}
          <div className="max-w-md mx-auto mb-5 px-4 text-center">
            <p className="text-sm md:text-base text-purple-200">
              Junte-se a mais de{' '}
              <strong className="text-yellow-300">
                {memberCountRounded.toLocaleString('pt-BR')}
              </strong>{' '}
              membros do Clube.
            </p>
          </div>

          {/* Pricing Card — fechamento */}
          <div id="clube-pricing" className="relative max-w-md mx-auto mb-16 scroll-mt-6 px-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-yellow-400 rounded-3xl blur opacity-60" />
            <div className="relative bg-black rounded-3xl p-8 border border-purple-500/30">
              <h2 className="text-center text-3xl md:text-4xl font-black mb-3 viplanding-gold-text">
                Desbloqueie o App · Anual
              </h2>
              <div className="text-center mb-6">
                {promo.isActive && (
                  <div className="text-purple-300 line-through text-sm">de R$ {promo.fullPrice}</div>
                )}
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-2xl font-light text-purple-300">R$</span>
                  <span className="text-7xl font-black viplanding-gold-text">
                    {promo.price}
                  </span>
                </div>
                <div className="text-sm text-purple-300">
                  por ano{promo.isActive ? ' · menos de R$ 6/mês' : ' · menos de R$ 17/mês'}
                </div>
                {promo.isActive && (
                  <div className="mt-1 text-[11px] uppercase tracking-wider font-bold text-yellow-300">
                    Promoção de lançamento do novo app
                  </div>
                )}
                <LaunchPromoCountdown />
              </div>

              <Button
                onClick={() => handleSubscribe('card')}
                disabled={loading}
                className="viplanding-gold-btn w-full h-14 text-base font-bold border-0 hover:text-black"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
                ) : (
                  <><Zap className="mr-2 h-5 w-5" /> Liberar todas as receitas</>
                )}
              </Button>
              <p className="text-center text-[11px] text-purple-300 mt-2">
                ✓ Renovação automática anual · cancele quando quiser
              </p>
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => handleSubscribe('pix')}
                  disabled={loading}
                  className="text-xs text-purple-200 underline underline-offset-4 hover:text-white transition disabled:opacity-50"
                >
                  Prefiro pagar via Pix (pagamento único · 12 meses)
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 mt-4 flex-nowrap">
                <span className="inline-flex items-center justify-center h-7 px-1.5 rounded-md bg-white shadow-sm"><img src={payVisa} alt="Cartão Visa" className="h-4 w-auto object-contain" /></span>
                <span className="inline-flex items-center justify-center h-7 px-1.5 rounded-md bg-white shadow-sm"><img src={payMaster} alt="Cartão Mastercard" className="h-5 w-auto object-contain" /></span>
                <span className="inline-flex items-center justify-center h-7 px-1.5 rounded-md bg-white shadow-sm"><img src={payApple} alt="Pagamento Apple Pay" className="h-4 w-auto object-contain" /></span>
                <span className="inline-flex items-center justify-center h-7 px-1.5 rounded-md bg-white shadow-sm"><img src={payGoogle} alt="Pagamento Google Pay" className="h-4 w-auto object-contain" /></span>
                <span className="inline-flex items-center justify-center h-7 px-1.5 rounded-md bg-white shadow-sm"><img src={payPix} alt="Pagamento via PIX" className="h-4 w-auto object-contain" /></span>
              </div>
              <TrustLine />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VipLandingB;
