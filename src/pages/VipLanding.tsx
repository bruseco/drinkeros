import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, Check, X, GlassWater, Sparkles, Zap, BookOpen, GraduationCap, Lock, Loader2, RefreshCw, Gift, PlayCircle, Wand2 } from 'lucide-react';
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
import vipLogo from '@/assets/logotipo-assinante-vip.png';

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

  // Trata retorno do Stripe Checkout
  useEffect(() => {
    const vipStatus = searchParams.get('vip');
    if (vipStatus === 'success') {
      toast.success('🎉 Bem-vindo ao VIP! Seu acesso já está liberado.');
      queryClient.invalidateQueries({ queryKey: ['user-plan'] });
      searchParams.delete('vip');
      setSearchParams(searchParams, { replace: true });
    } else if (vipStatus === 'cancel') {
      toast.info('Pagamento cancelado. Quando quiser, é só voltar 💜');
      searchParams.delete('vip');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/signup?redirect=/vip');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-vip-checkout');
      if (error) throw error;
      if (!data?.url) throw new Error('URL de checkout não recebida');
      window.location.href = data.url;
    } catch (err) {
      console.error('[vip-checkout]', err);
      toast.error('Não consegui abrir o checkout. Tenta de novo em instantes.');
      setLoading(false);
    }
  };

  // Esconde a página VIP de quem já é VIP, tem acesso vitalício
  // ou tem o conteúdo exclusivo "receitas" liberado.
  if (user && (planData?.isVip || hasLifetime || hasExclusive)) {
    return <Navigate to="/app/receitas" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-black to-purple-950 text-white relative overflow-hidden">
      {/* Glow effects */}
      <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-purple-600/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-yellow-400/10 blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <Link to="/app/receitas">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-10 object-contain brightness-0 invert" />
          </Link>
          <Link to="/app/receitas" className="text-sm text-purple-300 hover:text-white transition">
            Voltar
          </Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 border border-yellow-400/30 px-4 py-1.5 text-yellow-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5" />
            Oferta especial
          </div>
          <img
            src={vipLogo}
            alt="Assinante VIP"
            className="mx-auto h-40 md:h-56 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]"
          />
          <h1 className="text-4xl md:text-6xl font-black leading-none">
            <span className="text-white">Desbloqueie</span>{' '}
            <span className="bg-gradient-to-r from-yellow-300 to-yellow-100 bg-clip-text text-transparent">
              tudo
            </span>
          </h1>
          <p className="text-lg md:text-xl text-purple-200 max-w-2xl mx-auto">
            Pare de contar drinks. Beba conhecimento sem limites.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="relative max-w-md mx-auto mb-16">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-yellow-400 rounded-3xl blur opacity-75 animate-pulse" />
          <div className="relative bg-black rounded-3xl p-8 border border-purple-500/30">
            <div className="flex items-center justify-center mb-2">
              <img src={vipLogo} alt="VIP" className="h-20 object-contain" />
            </div>
            <h2 className="text-center text-2xl font-bold mb-2">Plano VIP Anual</h2>
            <div className="text-center mb-6">
              <div className="text-purple-300 line-through text-sm">de R$ 297</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl font-light text-purple-300">R$</span>
                <span className="text-7xl font-black bg-gradient-to-b from-yellow-200 to-yellow-500 bg-clip-text text-transparent">
                  69
                </span>
              </div>
              <div className="text-sm text-purple-300">por ano · menos de R$ 6/mês</div>
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full h-14 text-base font-bold bg-gradient-to-r from-yellow-400 to-yellow-300 hover:from-yellow-300 hover:to-yellow-200 text-black shadow-lg shadow-yellow-500/40"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo checkout...</>
              ) : (
                <><Zap className="mr-2 h-5 w-5" /> Quero ser VIP agora</>
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
              <li className="flex items-start gap-2 text-purple-200"><X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> Cursos com preço cheio</li>
            </ul>
          </div>

          {/* VIP */}
          <div className="relative rounded-2xl bg-gradient-to-br from-purple-900/60 to-fuchsia-900/40 border border-purple-400/40 p-6 shadow-2xl shadow-purple-500/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-2.5 py-1 text-xs font-bold uppercase">
                <Crown className="h-3 w-3" /> VIP
              </span>
              <span className="text-yellow-300 text-sm font-medium">o que você merece</span>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><strong className="text-white">Drinks ilimitados</strong>, todo dia</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><GlassWater className="inline h-3.5 w-3.5 text-yellow-300" /> <strong className="text-white">Xaropes Artesanais</strong> liberados</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><BookOpen className="inline h-3.5 w-3.5 text-yellow-300" /> <strong className="text-white">Todos os ebooks</strong> de presente</span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span>Acesso ao <strong className="text-white">Bebida Decifrada</strong></span></li>
              <li className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> <span><GraduationCap className="inline h-3.5 w-3.5 text-yellow-300" /> Cursos com <strong className="text-white">desconto VIP</strong></span></li>
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
                  <strong className="text-white"> volta a ficar acessível</strong> assim que você ativa o VIP.
                  Enquanto a sua assinatura estiver ativa, <strong className="text-white">tudo o que tem prazo continua liberado</strong>.
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
              Bônus exclusivos VIP
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
              <><Crown className="mr-2 h-5 w-5" /> Garantir minha vaga VIP por R$ 69</>
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
