import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Crown, Check, X, GlassWater, Sparkles, Zap, BookOpen, GraduationCap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useHasExclusiveAccess } from '@/hooks/useExclusiveAccess';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

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

  const handleSubscribe = () => {
    if (!user) {
      navigate('/signup');
      return;
    }
    // Placeholder — vai virar Stripe na Entrega 2
    alert('Pagamento será habilitado em breve! 💜');
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
          <h1 className="text-5xl md:text-7xl font-black leading-none">
            <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-yellow-200 bg-clip-text text-transparent">
              Vire VIP
            </span>
            <br />
            <span className="text-white">e desbloqueie</span>
            <br />
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
            <div className="flex items-center justify-center mb-4">
              <Crown className="h-12 w-12 text-yellow-400" />
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
              className="w-full h-14 text-base font-bold bg-gradient-to-r from-yellow-400 to-yellow-300 hover:from-yellow-300 hover:to-yellow-200 text-black shadow-lg shadow-yellow-500/40"
            >
              <Zap className="mr-2 h-5 w-5" />
              Quero ser VIP agora
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

        {/* CTA final */}
        <div className="text-center mb-16">
          <Button
            onClick={handleSubscribe}
            size="lg"
            className="h-14 px-12 text-base font-bold bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 shadow-lg shadow-purple-500/40"
          >
            <Crown className="mr-2 h-5 w-5" />
            Garantir minha vaga VIP por R$ 69
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
