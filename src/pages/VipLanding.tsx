import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, Check, X, GlassWater, Sparkles, Zap, BookOpen, GraduationCap, Loader2, RefreshCw, Gift, PlayCircle, Trophy } from 'lucide-react';
import jackDaniels from '@/assets/landing/bebida-decifrada/jack-daniels-degustacao.mp4';
import workshopVsl from '@/assets/landing/workshop/vsl.mp4';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useHasExclusiveAccess } from '@/hooks/useExclusiveAccess';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import clubeLogo from '@/assets/logotipo-clube-dos-drinkeros.png';
import bgTijolos from '@/assets/bg-tijolos-pretos.jpg';

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => navigate(-1), 280);
  };

  // Trata retorno do Stripe Checkout (mantém o param "vip" por compatibilidade do webhook)
  useEffect(() => {
    const status = searchParams.get('vip') || searchParams.get('clube');
    if (status === 'success') {
      toast.success('🎉 Bem-vindo ao Clube dos Drinkeros! Seu acesso já está liberado.');
      queryClient.invalidateQueries({ queryKey: ['user-plan'] });
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    } else if (status === 'cancel') {
      toast.info('Pagamento cancelado. Quando quiser, é só voltar 💜');
      searchParams.delete('vip');
      searchParams.delete('clube');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/signup?redirect=/clube');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-vip-checkout');
      if (error) throw error;
      if (!data?.url) throw new Error('URL de checkout não recebida');
      window.location.href = data.url;
    } catch (err) {
      console.error('[clube-checkout]', err);
      toast.error('Não consegui abrir o checkout. Tenta de novo em instantes.');
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
      className={`fixed inset-0 z-[60] text-white overflow-y-auto overscroll-contain bg-gradient-to-b from-purple-950 via-black to-purple-950 ${isClosing ? 'animate-[viplanding-fade-out_280ms_ease-in_forwards]' : 'animate-[viplanding-bounce-in_520ms_cubic-bezier(0.34,1.56,0.64,1)_forwards]'}`}
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
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-[80vh] md:h-[90vh] z-0"
        style={{
          backgroundImage: `url(${bgTijolos})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '900px auto',
          backgroundPosition: 'top center',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 15%, black 55%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 15%, black 55%, transparent 100%)',
        }}
      />
      {/* Degradês pretos animados por cima do tijolo — dão vida ao topo */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[80vh] md:h-[90vh] z-0 overflow-hidden">
        <div className="absolute -top-20 -left-24 h-[22rem] w-[22rem] rounded-full bg-black/70 blur-3xl animate-[viplanding-blob1_20s_ease-in-out_infinite]" />
        <div className="absolute top-10 -right-24 h-[24rem] w-[24rem] rounded-full bg-black/60 blur-3xl animate-[viplanding-blob2_24s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 left-1/4 h-[20rem] w-[20rem] rounded-full bg-black/50 blur-3xl animate-[viplanding-blob3_28s_ease-in-out_infinite]" />
      </div>

      {/* Blobs animados de degradê roxo/pink — passam por cima do tijolo e seguem abaixo */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/4 -right-40 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/25 blur-3xl animate-[viplanding-blob2_22s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/4 h-[24rem] w-[24rem] rounded-full bg-pink-500/20 blur-3xl animate-[viplanding-blob3_26s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 right-1/4 h-[28rem] w-[28rem] rounded-full bg-purple-700/30 blur-3xl animate-[viplanding-blob4_24s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/3 -left-32 h-[28rem] w-[28rem] rounded-full bg-purple-600/25 blur-3xl animate-[viplanding-blob1_18s_ease-in-out_infinite]" />
      </div>
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

      {/* X fechar — fixo no canto direito da viewport */}
      <Link
        to="/app/receitas"
        aria-label="Fechar"
        className="absolute right-4 top-5 z-40 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition"
      >
        <X className="h-4 w-4" />
      </Link>

      <div className="relative z-30 container mx-auto max-w-4xl">
        {/* Header — logo Drinkeros centralizado (h-16, logo h-10) */}
        <div className="relative flex h-16 items-center justify-center px-4 mb-8">
          <Link to="/app/receitas" aria-label="Drinkeros">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-10 object-contain brightness-0 invert" />
          </Link>
        </div>

        {/* Content */}

        {/* Hero */}
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 border border-yellow-400/30 px-4 py-1.5 text-yellow-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5" />
            Oferta especial
          </div>
          <img
            src={clubeLogo}
            alt="Clube dos Drinkeros"
            className="mx-auto h-40 md:h-56 object-contain [filter:drop-shadow(0_10px_25px_rgba(0,0,0,0.85))_drop-shadow(0_0_40px_rgba(0,0,0,0.7))]"
          />
          <h1 className="text-4xl md:text-6xl font-black leading-none">
            <span className="text-white">Seja</span>{' '}
            <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">
              sócio
            </span>{' '}
            <span className="text-white">do clube</span>
          </h1>
          <p className="text-lg md:text-xl text-purple-200 max-w-2xl mx-auto">
            Pare de contar drinks. Beba conhecimento sem limites e participe da Batalha dos Drinkeros.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="relative max-w-md mx-auto mb-16">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-yellow-400 rounded-3xl blur opacity-75 animate-pulse" />
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
              onClick={handleSubscribe}
              disabled={loading}
              className="viplanding-gold-btn w-full h-14 text-base font-bold border-0 hover:text-black"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
              ) : (
                <><Zap className="mr-2 h-5 w-5" /> Quero ser sócio do Clube</>
              )}
            </Button>
            <p className="text-center text-xs text-purple-300 mt-3">
              💳 Pagamento seguro · cancele quando quiser
            </p>
          </div>
        </div>

        {/* Comparison */}
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          {/* Free */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-lime-400 text-lime-950 px-2.5 py-1 text-xs font-bold uppercase">
                <Sparkles className="h-3 w-3" /> Grátis
              </span>
              <span className="text-purple-300 text-sm">o que você tem hoje</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Apenas <strong>3 drinks por dia</strong></li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Sem acesso aos <strong>Xaropes Artesanais</strong></li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Sem ebooks</li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Sem Bebida Decifrada</li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Não participa da <strong>Batalha dos Drinkeros</strong></li>
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Cursos com preço cheio</li>
            </ul>
          </div>

          {/* Sócio */}
          <div className="relative rounded-2xl bg-gradient-to-br from-purple-900/60 to-fuchsia-900/40 border border-purple-400/40 p-6 shadow-2xl shadow-purple-500/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-2.5 py-1 text-xs font-bold uppercase">
                <Crown className="h-3 w-3" /> Sócio
              </span>
              <span className="text-yellow-300 text-sm font-medium">o que você merece</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">Drinks ilimitados</strong>, todo dia</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><GlassWater className="inline h-3.5 w-3.5 text-yellow-300" /> <strong className="text-white">Xaropes Artesanais</strong> liberados</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><BookOpen className="inline h-3.5 w-3.5 text-yellow-300" /> <strong className="text-white">Todos os ebooks</strong> de presente</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Acesso ao <strong className="text-white">Bebida Decifrada</strong></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><Trophy className="inline h-3.5 w-3.5 text-yellow-300" /> Participa da <strong className="text-white">Batalha dos Drinkeros</strong></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><GraduationCap className="inline h-3.5 w-3.5 text-yellow-300" /> Cursos com <strong className="text-white">desconto de sócio</strong></span></li>
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

        {/* Bônus exclusivos */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 border border-yellow-400/30 px-4 py-1.5 text-yellow-300 text-xs font-bold uppercase tracking-widest mb-3">
              <Gift className="h-3.5 w-3.5" />
              Bônus exclusivos do Clube
            </div>
            <h2 className="text-3xl md:text-4xl font-black">
              E ainda leva <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">esses presentes</span>
            </h2>
          </div>

          <div className="space-y-10">
            {/* Bônus 1 - Bebida Decifrada */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/30 overflow-hidden p-6">
              <div className="w-[70%] sm:w-full max-w-md aspect-square mx-auto rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl mb-5 bg-black">
                <video
                  src={jackDaniels}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
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
                <video
                  src={workshopVsl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
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
              </div>
            </div>
          </div>
        </div>

        {/* CTA final */}
        <div className="text-center mb-16">
          <Button
            onClick={handleSubscribe}
            disabled={loading}
            size="lg"
            className="h-14 px-12 text-base font-bold bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 shadow-lg shadow-purple-500/40"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
            ) : (
              <><Crown className="mr-2 h-5 w-5" /> Garantir minha vaga no Clube por R$ 69</>
            )}
          </Button>
          <p className="text-sm text-purple-300 mt-4">
            Você merece beber sem limites 🍹
          </p>
        </div>
      </div>
    </div>
  );
};

export default VipLanding;
