import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, Check, X, GlassWater, Sparkles, Zap, BookOpen, GraduationCap, Loader2, RefreshCw, Gift, PlayCircle, Trophy } from 'lucide-react';
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
import { trackFbEvent } from '@/lib/metaPixel';
import { useViewContent } from '@/hooks/useViewContent';

import clubeLogo from '@/assets/logotipo-clube-dos-drinkeros.png';
import bgTijolos from '@/assets/bg-tijolos-pretos.jpg';
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


const VipLanding: React.FC = () => {
  const { user } = useAuth();
  const { data: planData } = useUserPlan();
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
  const [isClosing, setIsClosing] = useState(false);

  useViewContent({
    key: 'clube-dos-drinkeros',
    content_name: 'Clube dos Drinkeros',
    content_category: 'clube',
    content_type: 'product',
    value: 69,
    currency: 'BRL',
  });

  const handleClose = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (isClosing) return;
    setIsClosing(true);
    const fromState = (location.state as { from?: string } | null)?.from;
    setTimeout(() => {
      // Se veio de uma receita bloqueada (state.from), volta direto pra listagem.
      // Caso contrário tenta o histórico, com fallback pra /app/receitas.
      if (fromState) {
        navigate(fromState, { replace: true });
      } else {
        navigate('/app/receitas', { replace: true });
      }
    }, 280);
  };

  // Trata retorno do checkout (mantém o param "vip" por compatibilidade do fluxo antigo)
  useEffect(() => {
    const status = searchParams.get('vip') || searchParams.get('clube');
    if (status === 'success') {
      toast.success('🎉 Bem-vindo ao Clube dos Drinkeros! Seu acesso já está liberado.');
      queryClient.invalidateQueries({ queryKey: ['user-plan'] });
      trackFbEvent(
        'Subscribe',
        {
          value: 69.0,
          currency: 'BRL',
          content_name: 'Clube dos Drinkeros Anual',
          content_type: 'subscription',
        },
        { dedupeKey: `clube-success:${user?.id || 'anon'}` }
      );
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    } else if (status === 'cancel') {
      toast.info('Pagamento cancelado. Quando quiser, é só voltar 💜');
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    } else if (status === 'pending') {
      toast.info('Pagamento em análise. Assim que aprovar, seu Clube será liberado.');
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
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-club-checkout', {
        body: { method: chosenMethod },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('URL de checkout não retornada');
      window.location.href = data.url;
    } catch (err: any) {
      toast.error('Erro ao iniciar checkout', { description: err.message });
      setLoading(false);
    }
  };

  // Esconde a página de quem já é sócio do Clube, tem acesso vitalício
  // ou tem o conteúdo exclusivo "receitas" liberado.
  if (user && (planData?.isVip || hasLifetime || hasExclusive)) {
    return <Navigate to="/app/receitas" replace />;
  }

  return (
    <div
      className={`fixed inset-0 z-[60] text-white overflow-y-auto overscroll-contain bg-black ${isClosing ? 'animate-[viplanding-fade-out_280ms_ease-in_forwards]' : 'animate-[viplanding-bounce-in_520ms_cubic-bezier(0.34,1.56,0.64,1)_forwards]'}`}
    >
      {/* Animações de entrada/saída */}
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
      `}</style>
      {/* Faixa de tijolos preta no topo — fade suave nas bordas para evitar quebra reta */}
      {/* Primeira dobra sem degradês — fundo preto sólido */}

      <style>{`
        @keyframes viplanding-blob1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40vw, 20vh) scale(1.2); }
        }
        @keyframes viplanding-blob2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50vw, 30vh) scale(1.15); }
        }
        @keyframes viplanding-blob3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30vw, -20vh) scale(1.25); }
        }
        @keyframes viplanding-blob4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-35vw, -25vh) scale(1.1); }
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
        .viplanding-gold-btn:hover {
          filter: brightness(1.05);
        }
      `}</style>

      {/* Botão de fechar removido — usuário volta pelo browser */}

      {/* Topo com fundo de tijolo */}
      <div
        className="relative"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.7) 60%, #000 100%), url(${bgTijolos})`,
          backgroundSize: '200% auto',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="relative z-30 container mx-auto max-w-4xl">
          {/* Hero */}
          <div className="text-center pt-10 space-y-3 px-4">
            <h1 className="text-4xl md:text-6xl font-black leading-none">
              <span className="text-white">Seja</span>{' '}
              <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">
                sócio
              </span>{' '}
              <span className="text-white">do Clube dos Drinkeros</span>
            </h1>
            <img
              src={clubeLogo}
              alt="Clube dos Drinkeros"
              aria-hidden="true"
              className="mx-auto h-32 md:h-44 object-contain [filter:drop-shadow(0_10px_25px_rgba(0,0,0,0.85))_drop-shadow(0_0_40px_rgba(0,0,0,0.7))]"
            />
          </div>
        </div>
      </div>

      {/* Parte de baixo com degradês roxo/pink */}
      <div className="relative overflow-hidden">
        {/* Blobs decorativos */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute top-[5%] -left-32 w-[480px] h-[480px] rounded-full bg-purple-700/30 blur-[120px]" />
          <div className="absolute top-[25%] -right-40 w-[520px] h-[520px] rounded-full bg-fuchsia-600/25 blur-[130px]" />
          <div className="absolute top-[55%] -left-24 w-[420px] h-[420px] rounded-full bg-pink-600/25 blur-[120px]" />
          <div className="absolute bottom-[5%] -right-32 w-[460px] h-[460px] rounded-full bg-purple-600/30 blur-[130px]" />
        </div>

        <div className="relative z-10 container mx-auto max-w-4xl">

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-10 mt-2 sm:mx-0 relative left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 w-[calc(100vw-6px)] sm:w-auto">
          {/* Free */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-lime-400 text-lime-950 px-2.5 py-1 text-xs font-bold uppercase w-fit">
                <Sparkles className="h-3 w-3" /> Grátis
              </span>
              <span className="text-purple-300 text-xs sm:text-sm">o que você tem hoje</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Você pode ver só <strong>3 drinks por dia</strong></span></li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Sem acesso aos <strong>Xaropes Artesanais</strong></span></li>
              
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Sem Bebida Decifrada</span></li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Não participa da <strong>Batalha dos Drinkeros</strong></span></li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> <span>Cursos com preço cheio</span></li>
            </ul>
          </div>

          {/* Sócio */}
          <div className="relative rounded-2xl bg-gradient-to-br from-purple-900/60 to-fuchsia-900/40 border border-purple-400/40 p-4 md:p-6 shadow-2xl shadow-purple-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-2.5 py-1 text-xs font-bold uppercase w-fit">
                <Crown className="h-3 w-3" /> Sócio
              </span>
              <span className="text-yellow-300 text-xs sm:text-sm font-medium">o que você merece</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">Veja quantos Drinks você quiser.</strong></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><GlassWater className="inline h-3.5 w-3.5 text-yellow-300" /> <strong className="text-white">Xaropes Artesanais</strong> liberados</span></li>
              
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Acesso a minissérie <strong className="text-white">Bebida Decifrada</strong></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><GraduationCap className="inline h-3.5 w-3.5 text-yellow-300" /> Acesso ao <strong className="text-white">Workshop Além dos Clássicos</strong> (com certificado)</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><Trophy className="inline h-3.5 w-3.5 text-yellow-300" /> Participa da <strong className="text-white">Batalha dos Drinkeros</strong></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Sócios ganham <strong className="text-white">80% de desconto</strong> na compra de qualquer produto.</span></li>
            </ul>
          </div>
        </div>

        {/* Reativação de cursos expirados */}
        <div className="relative max-w-3xl mx-auto mb-12">
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
                  <strong className="text-white"> volta a ficar acessível</strong> assim que você se torna sócio do Clube.
                  Enquanto a sua participação no Clube estiver ativa, <strong className="text-white">tudo o que tem prazo continua liberado</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA âncora para o card de preço */}
        <div className="max-w-md mx-auto mb-16 px-4">
          <Button
            onClick={() => {
              document.getElementById('clube-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="viplanding-gold-btn w-full h-14 text-base font-bold border-0 hover:text-black"
          >
            <Crown className="mr-2 h-5 w-5" /> Quero ser sócio!
          </Button>
        </div>

        {/* Bônus exclusivos */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 border border-yellow-400/30 px-4 py-1.5 text-yellow-300 text-xs font-bold uppercase tracking-widest mb-3">
              <Gift className="h-3.5 w-3.5" />
              Bônus exclusivos do Clube
            </div>
            <h2 className="text-3xl md:text-4xl font-black">
              Saiba mais sobre <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">cada bônus</span>
            </h2>
          </div>

          <div className="space-y-10">
            {/* Bônus 1 - Bebida Decifrada */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/30 overflow-hidden p-6">
              <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                <VideoWithPoster src={jackDaniels} poster={bebidaCover} alt="Bebida Decifrada" />
              </div>
              <div className="text-center max-w-xl mx-auto">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <PlayCircle className="h-5 w-5 text-yellow-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 1</span>
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

            {/* Bônus 2 - Workshop Além dos Clássicos */}
            <div className="rounded-2xl bg-gradient-to-br from-fuchsia-900/40 to-black border border-fuchsia-500/30 overflow-hidden p-6">
              <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                <VideoWithPoster src={workshopVsl} poster={workshopCover} alt="Workshop Além dos Clássicos" />
              </div>
              <div className="text-center max-w-xl mx-auto">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <GraduationCap className="h-5 w-5 text-yellow-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 2</span>
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

            {/* Bônus 3 - Batalha dos Drinkeros */}
            <div className="rounded-2xl bg-gradient-to-br from-yellow-900/30 to-black border border-yellow-500/30 overflow-hidden p-6">
              <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                <VideoWithPoster src="/vinheta-batalha-dos-drinkeros-web.mp4" poster="/batalha-video-poster.jpg" alt="Batalha dos Drinkeros" />
              </div>
              <div className="text-center max-w-xl mx-auto">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-yellow-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 3</span>
                </div>
                <h3 className="text-2xl font-black mb-2">Batalha dos Drinkeros</h3>
                <p className="text-sm text-purple-200 leading-snug">
                  Toda semana, sócios do Clube competem com seus drinks autorais.
                  Os <strong className="text-white">melhores do mês</strong> ganham destaque e disputam o título de
                  <strong className="text-white"> melhor drinker do ano</strong>.
                </p>
                <p className="mt-3 text-sm text-purple-100 leading-snug">
                  Todo mês, o <strong className="text-yellow-300">1º lugar do ranking</strong> ganha{' '}
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

            {/* Bônus 4 - Xaropes Artesanais */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/30 overflow-hidden p-6">
              <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                <VideoWithPoster src={xaropesVideo} poster={xaropesCover} alt="Xaropes Artesanais" />
              </div>
              <div className="text-center max-w-xl mx-auto">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <GlassWater className="h-5 w-5 text-yellow-300" />
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">Bônus 4</span>
                </div>
                <h3 className="text-2xl font-black mb-2">Xaropes Artesanais</h3>
                <p className="text-sm text-purple-200 leading-snug">
                  Aprenda a fazer os <strong className="text-white">xaropes que dão alma aos seus drinks</strong>.
                  Receitas exclusivas e fáceis pra você levar seus coquetéis pra outro nível.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Card — fechamento da página */}
        <div id="clube-pricing" className="relative max-w-md mx-auto mb-16 scroll-mt-6">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-yellow-400 rounded-3xl blur opacity-60" />
          <div className="relative bg-black rounded-3xl p-8 border border-purple-500/30">
            <h2 className="text-center text-3xl md:text-4xl font-black mb-3 viplanding-gold-text">
              Sócio do Clube · Anual
            </h2>
            <div className="text-center mb-6">
              <div className="text-purple-300 line-through text-sm">de R$ 297</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl font-light text-purple-300">R$</span>
                <span className="text-7xl font-black viplanding-gold-text">
                  69
                </span>
              </div>
              <div className="text-sm text-purple-300">por ano · menos de R$ 6/mês</div>
            </div>

            <Button
              onClick={() => handleSubscribe('card')}
              disabled={loading}
              className="viplanding-gold-btn w-full h-14 text-base font-bold border-0 hover:text-black"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
              ) : (
                <><Zap className="mr-2 h-5 w-5" /> Quero ser Sócio do Clube</>
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
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default VipLanding;
