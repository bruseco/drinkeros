import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, ShoppingCart, CheckCircle2, ShieldCheck, MessageCircle, Crown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useCourseBySlug } from '@/hooks/useCourses';
import { VIP_DISCOUNT_PERCENT, applyVipDiscount, formatBRL } from '@/lib/vipDiscount';
import AnimatedStudentCount from '@/components/landing/AnimatedStudentCount';
import VipFloatingBanner from '@/components/landing/VipFloatingBanner';

// Imagens
import logo from '@/assets/landing/dx/logo.png';
import brunoHero from '@/assets/landing/dx/bruno-hero.png';
import garantia from '@/assets/landing/dx/garantia-15dias.png';
import pagamentos from '@/assets/landing/dx/pagamentos.png';

import learn1 from '@/assets/landing/dx/learn-1.jpg';
import learn2 from '@/assets/landing/dx/learn-2.jpg';
import learn3 from '@/assets/landing/dx/learn-3.jpg';
import learn4 from '@/assets/landing/dx/learn-4.jpg';
import learn5 from '@/assets/landing/dx/learn-5.jpg';
import learn6 from '@/assets/landing/dx/learn-6.jpg';
import learn7 from '@/assets/landing/dx/learn-7.jpg';
import learn8 from '@/assets/landing/dx/learn-8.jpg';
import learn9 from '@/assets/landing/dx/learn-9.jpg';

import dep1 from '@/assets/landing/dx/dep-1.jpg';
import dep2 from '@/assets/landing/dx/dep-2.jpg';
import dep3 from '@/assets/landing/dx/dep-3.jpg';
import dep4 from '@/assets/landing/dx/dep-4.jpg';

import perfilHobbie from '@/assets/landing/dx/perfil-hobbie.jpg';
import perfilBartender from '@/assets/landing/dx/perfil-bartender.jpg';
import perfilEmpresario from '@/assets/landing/dx/perfil-empresario.jpg';

import bonusNew1 from '@/assets/landing/dx/bonus-new-1.jpg';
import bonusNew2 from '@/assets/landing/dx/bonus-new-2.jpg';
import bonusNew3 from '@/assets/landing/dx/bonus-new-3.jpg';
import bonusNew4 from '@/assets/landing/dx/bonus-new-4.jpg';

const SLUG = 'drinkeros-xperience';

const learnItems = [
  { img: learn1, html: 'Aprenda <strong>AS PROPORÇÕES MÁGICAS</strong> que vão te permitir criar infinitas receitas, assim como fazemos diariamente em nossas redes sociais.' },
  { img: learn2, html: 'Aprenda todos os segredinhos para fazer <strong>A CAIPIRINHA PERFEITA</strong>. Aprenda também a fazer as <strong>CAIPIFRUTAS</strong> e as <strong>CAIPIRINHAS GOURMETS</strong>.' },
  { img: learn3, html: 'Vou te ensinar sobre os <strong>DRINKS CLÁSSICOS</strong> mais famosos do mundo. Você aprenderá suas proporções e como criar variações incríveis deles.' },
  { img: learn4, html: 'Saiba <strong>TUDO SOBRE UTENSÍLIOS</strong> da coquetelaria. Vou apresentar cada um deles e também vou lhe ensinar como manuseá-los.' },
  { img: learn5, html: 'Descubra quais são os <strong>INGREDIENTES QUE NÃO PODEM FALTAR</strong> na sua casa. Aprenda alguns <strong>XAROPES CASEIROS</strong> e entenda tudo sobre os <strong>TIPOS DE GELO</strong>.' },
  { img: learn6, html: 'Você vai entender tudo sobre as <strong>TAÇAS E COPOS</strong>, para que serve cada uma delas e qual ocasião você deve fazer cada tipo de drink.' },
  { img: learn7, html: 'Vou também te ensinar os métodos para você fazer as <strong>BATIDAS, FROZENS e DRINKS EM CAMADAS</strong>.' },
  { img: learn8, html: 'Vou te ensinar como aumentar as proporções dos drinks para fazer <strong>DRINKS EM JARRAS E SUQUEIRAS</strong>.' },
  { img: learn9, html: 'Comemore em grande estilo com seus amigos e familiares dominando a arte de fazer <strong>SHOTS</strong>.' },
];

const perfilItems = [
  { img: perfilHobbie, title: 'Hobbie/Lazer', desc: 'Para você que quer aproveitar melhor com amigos e familiares proporcionando momentos especiais, unir pessoas, trazer alegria e momentos de distração.' },
  { img: perfilBartender, title: 'Bartender', desc: 'Para você que já é bartender profissional ou quer seguir carreira e aprimorar seus conhecimentos.' },
  { img: perfilEmpresario, title: 'Empresário(a)', desc: 'Para você que é dono de um bar, restaurante, quiosque ou balada e quer capacitar melhor sua equipe e aprender esta nova habilidade lucrativa.' },
];

const bonusItems = [
  { img: bonusNew1, title: 'BÔNUS 1 — DRINKS SEM ÁLCOOL', desc: 'Aula divertida com o método para criar qualquer drink sem álcool, sem precisar ficar pesquisando receitas na internet.' },
  { img: bonusNew2, title: 'BÔNUS 2 — DECORAÇÕES', desc: 'Aula especial com tudo que você precisa saber sobre decorações: técnicas e estilos para deixar seus drinks visualmente incríveis.' },
  { img: bonusNew3, title: 'BÔNUS 3 — FOTOGRAFIA DE DRINKS COM CELULAR', desc: 'Aprenda a fotografar seus drinks usando apenas o seu celular, com técnicas que deixam suas fotos profissionais e prontas para as redes.' },
  { img: bonusNew4, title: 'BÔNUS 4 — HORTINHA AUTOMATIZADA', desc: 'Monte uma hortinha suspensa em casa com irrigação automatizada e tenha sempre ervas frescas à mão para criar drinks de outro nível.' },
];

const faqItems = [
  { q: 'Não sou profissional, esse curso é pra mim?', a: 'Se você curte drinks apenas por hobby, esse curso É PERFEITO PRA VOCÊ, inclusive 60% dos nossos alunos relataram que estão fazendo o curso por um Hobby que é quase uma terapia.' },
  { q: 'Quanto tempo terei acesso ao curso?', a: 'O acesso é de 1 ano, ou seja, você terá direito a todos os vídeos do Drinkeros Xperience durante 365 dias.' },
  { q: 'Como recebo o acesso ao curso?', a: 'Após a aprovação do pagamento, você receberá os dados de acesso automaticamente no e-mail cadastrado no ato da compra. Por isso, é importante que você cadastre um e-mail válido. Importante verificar também na caixa de spam.' },
  { q: 'O pagamento realmente é seguro?', a: 'Confiamos inteiramente na plataforma que utilizamos para receber o seu pagamento. Utilizamos o Stripe, uma das maiores plataformas de pagamento do mundo. Então sim, é muito seguro.' },
  { q: 'Em quanto tempo consigo reaver meu investimento do curso?', a: 'A partir do momento que um aluno termina o curso, ele já estará apto a botar todo o conhecimento em prática, podendo ir atrás de seus próprios clientes ou buscar uma promoção dentro do seu próprio estabelecimento.' },
  { q: 'Sou menor de 18 anos, posso fazer o curso?', a: 'O curso não é recomendado para menores de 18 anos. Caso seja menor, peça para seu responsável, pois também ensinamos drinks sem álcool.' },
  { q: 'Como é essa garantia que você oferece?', a: 'É muito simples: não queremos merecer o seu dinheiro se o treinamento não for impactante para você. Faça o programa, acesse tudo e se achar que não é bom para você ou que não era o que estava esperando, simplesmente mande um e-mail para nossa equipe e peça a devolução do seu dinheiro ainda dentro do prazo de garantia.' },
  { q: 'Como assisto às aulas?', a: 'As aulas poderão ser acessadas por qualquer dispositivo que tenha acesso à internet. Isso inclui tablet, celular, desktop, notebook, Smart TV, Xbox, Playstation e demais dispositivos.' },
  { q: 'Já sou bartender profissional, esse curso é para mim?', a: 'Se você é bartender profissional, ou trabalha em algum restaurante que serve drinks, tenho certeza que você vai atualizar suas habilidades e expandir sua criatividade.' },
  { q: 'Ainda tenho dúvida, o que eu faço?', a: 'Você pode fazer contato com a minha equipe através do e-mail: suporte@drinkeros.com.br' },
];

const DrinkerosXperience: React.FC = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: course } = useCourseBySlug(SLUG);
  const { data: userPlan } = useUserPlan();
  const isVip = !!userPlan?.isVip;

  // Toast de checkout
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

  // Hero video: autoplay muted + unmute na primeira interação
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
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
      cleanup();
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
    const cleanup = () => events.forEach(e => window.removeEventListener(e, unmute));
    events.forEach(e => window.addEventListener(e, unmute, { passive: true }));
    return cleanup;
  }, []);

  // Preço (com fallback para o valor da página antiga: R$ 497)
  const dbPrice = (course as any)?.price ? Number((course as any).price) : null;
  const basePrice = dbPrice ?? 497;
  const finalPrice = isVip ? applyVipDiscount(basePrice) : basePrice;
  const installments = (finalPrice / 12).toFixed(2).replace('.', ',');

  const handleBuy = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-product-checkout', {
        body: { product_type: 'course', slug: SLUG },
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
      className={`dx-cta group relative inline-flex items-center justify-center gap-2 rounded-full font-extrabold text-white transition-transform duration-300 hover:scale-[1.03] overflow-hidden isolate ${size === 'xl' ? 'px-10 py-6 text-xl' : 'px-8 py-5 text-base sm:text-lg'}`}
    >
      <span className="dx-cta-liquid" aria-hidden="true" />
      <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{children}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white overflow-x-hidden">
      {!isVip && (
        <VipFloatingBanner watchTargetId="dx-matricule-cta" basePrice={basePrice} />
      )}
      {/* Animação do gradiente do hero */}
      <style>{`
        @keyframes dxAuroraDrift {
          0%   { background-position: 0% 50%, 100% 50%, 50% 0%, 0 0; }
          50%  { background-position: 100% 50%, 0% 50%, 50% 100%, 0 0; }
          100% { background-position: 0% 50%, 100% 50%, 50% 0%, 0 0; }
        }
        .dx-aurora {
          background:
            radial-gradient(60% 60% at 25% 30%, rgba(88, 28, 135, 0.55), transparent 60%),
            radial-gradient(55% 55% at 75% 65%, rgba(131, 24, 67, 0.55), transparent 60%),
            radial-gradient(70% 70% at 50% 100%, rgba(120, 53, 15, 0.35), transparent 60%),
            linear-gradient(180deg, #07030a 0%, #050507 100%);
          background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
          animation: dxAuroraDrift 18s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .dx-aurora { animation: none; }
          .dx-cta-liquid, .dx-cta { animation: none !important; }
        }

        /* CTA líquido animado */
        @keyframes dxLiquidFlow {
          0%   { background-position: 0% 50%, 50% 0%, 100% 100%, -140% 50%; }
          50%  { background-position: 100% 50%, 50% 100%, 0% 0%, 220% 50%; }
          100% { background-position: 0% 50%, 50% 0%, 100% 100%, 220% 50%; }
        }
        @keyframes dxGlowPulse {
          0%, 100% {
            box-shadow:
              0 8px 30px rgba(251,146,60,0.45),
              0 0 40px rgba(236,72,153,0.25),
              0 0 0 0 rgba(251,146,60,0.0);
          }
          50% {
            box-shadow:
              0 14px 50px rgba(251,146,60,0.7),
              0 0 80px rgba(236,72,153,0.55),
              0 0 0 6px rgba(251,146,60,0.05);
          }
        }
        .dx-cta {
          background: linear-gradient(90deg, #fbbf24, #f97316, #ec4899);
          animation: dxGlowPulse 3.2s ease-in-out infinite;
          -webkit-mask-image: -webkit-radial-gradient(white, black);
          transform: translate3d(0, 0, 0);
          will-change: transform, box-shadow;
        }
        .dx-cta-liquid {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          overflow: hidden;
          background:
            radial-gradient(60% 120% at 20% 40%, rgba(255, 220, 130, 0.85), transparent 60%),
            radial-gradient(70% 130% at 60% 70%, rgba(244, 114, 182, 0.75), transparent 65%),
            radial-gradient(80% 140% at 90% 30%, rgba(249, 115, 22, 0.85), transparent 60%),
            linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 45%, transparent 70%);
          background-size: 220% 220%, 220% 220%, 220% 220%, 45% 100%;
          background-repeat: no-repeat;
          animation: dxLiquidFlow 8s ease-in-out infinite;
          filter: saturate(1.15);
          z-index: 0;
          pointer-events: none;
          transform: translate3d(0, 0, 0);
        }

        /* Variante verde */
        .dx-cta-green {
          background: linear-gradient(90deg, #84cc16, #16a34a, #15803d);
          animation: dxGlowPulseGreen 3.2s ease-in-out infinite;
        }
        @keyframes dxGlowPulseGreen {
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
        .dx-cta-green .dx-cta-liquid {
          background:
            radial-gradient(60% 120% at 20% 40%, rgba(163, 230, 53, 0.9), transparent 60%),
            radial-gradient(70% 130% at 60% 70%, rgba(34, 139, 34, 0.85), transparent 65%),
            radial-gradient(80% 140% at 90% 30%, rgba(21, 128, 61, 0.95), transparent 60%),
            linear-gradient(90deg, transparent 0%, rgba(190,242,100,0.35) 45%, transparent 70%);
          background-size: 220% 220%, 220% 220%, 220% 220%, 45% 100%;
          background-repeat: no-repeat;
        }
      `}</style>

      {/* HERO — apenas logo + headline + vídeo + CTA na primeira dobra */}
      <section className="relative dx-aurora min-h-screen flex items-start">
        <div className="container mx-auto px-4 pt-8 pb-6 sm:pt-12 sm:pb-10 text-center relative z-10">
          <img
            src={logo}
            alt="Curso Drinkeros Xperience"
            className="h-32 sm:h-48 lg:h-60 mx-auto mb-4 drop-shadow-[0_4px_24px_rgba(236,72,153,0.55)]"
          />
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold uppercase tracking-tight mb-3 leading-[1.05] max-w-4xl mx-auto">
            Descubra os segredos<br />por trás dos drinks.
          </h1>

          {/* VÍDEO logo abaixo do headline */}
          <div className="w-[240px] sm:w-[280px] mx-auto aspect-square rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(236,72,153,0.35)] ring-1 ring-white/10 mb-4 bg-black">
            <video
              ref={heroVideoRef}
              src="https://pvjlcfhqueibjnkuzzna.supabase.co/storage/v1/object/public/landing-assets/drinkeros-xperience/clipe.mp4"
              controls
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            />
          </div>

          <p className="text-base sm:text-xl font-bold text-yellow-300 mb-3 max-w-3xl mx-auto">
            Aprenda as proporções de destilado, dulçor, acidez e amargor e CRIE SEUS PRÓPRIOS DRINKS.
          </p>
          <p className="text-sm sm:text-base text-white mb-5 max-w-3xl mx-auto">
            Caipirinha perfeita, capifrutas, caipirinhas gourmets, drinks clássicos, batidas, frozens, drinks em camadas, jarras, suqueiras, shots e muito mais.
          </p>

          <div className="flex justify-center mt-4">
            <CTAButton size="lg">QUERO VIRAR DRINKERO(A)</CTAButton>
          </div>
        </div>
      </section>

      {/* O QUE VAI APRENDER */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] via-[#150810] to-[#0b0b0d]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-16">
            O que vou aprender <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">nesse curso?</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {learnItems.map((item, i) => (
              <div key={i} className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_40px_rgba(236,72,153,0.2)]">
                <div className="aspect-video overflow-hidden">
                  <img src={item.img} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="p-5">
                  <p className="text-sm sm:text-base text-white/85" dangerouslySetInnerHTML={{ __html: item.html }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-center mt-12 text-2xl font-bold bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
            E MUITO MAIS…
          </p>
        </div>
      </section>

      {/* CONTAGEM DE ALUNOS */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg sm:text-xl font-semibold uppercase tracking-wider opacity-90">Já certificamos</p>
          <p className="text-6xl sm:text-7xl lg:text-8xl font-black my-2 drop-shadow-lg tabular-nums">
            <AnimatedStudentCount target={22341} />
          </p>
          <p className="text-lg sm:text-xl font-semibold uppercase tracking-wider opacity-90">alunos até o momento</p>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-16 sm:py-24 bg-[#0b0b0d]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-12">
            Veja alguns <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">depoimentos</span> de nossos alunos
          </h2>
          <div className="flex flex-col gap-6 max-w-2xl mx-auto">
            {[dep1, dep2, dep3, dep4].map((src, i) => (
              <div key={i} className="rounded-xl overflow-hidden ring-1 ring-white/10 hover:ring-pink-500/50 transition-all hover:scale-[1.01]">
                <img src={src} alt={`Depoimento ${i + 1}`} loading="lazy" className="w-full h-auto" />
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-12">
            <CTAButton>QUERO COMEÇAR</CTAButton>
          </div>
        </div>
      </section>

      {/* PARA QUEM É */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] to-[#150810]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-16">
            Para quem é <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">recomendado</span> esse curso?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {perfilItems.map((item, i) => (
              <div key={i} className="text-center flex flex-col items-center">
                <div className="aspect-square w-1/2 md:w-full rounded-full overflow-hidden mb-6 ring-2 ring-white/10 hover:ring-pink-500/60 transition-all hover:scale-[1.02]">
                  <img src={item.img} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-2xl font-extrabold mb-3 bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
                  {item.title}
                </h3>
                <p className="text-white/80 text-base">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BÔNUS — agora com 4 */}
      <section className="py-16 sm:py-24 bg-[#0b0b0d]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-4">
            Calma que <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">ainda não acabou!</span>
          </h2>
          <p className="text-center text-lg sm:text-xl text-white/80 max-w-3xl mx-auto mb-16">
            Se liga nos <strong className="text-amber-400">4 BÔNUS</strong> que você ganhará ao adquirir o <strong>curso Drinkeros Xperience</strong>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {bonusItems.map((b, i) => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-pink-500/50 transition-all hover:scale-[1.02] hover:shadow-[0_10px_40px_rgba(236,72,153,0.18)]">
                <div className="aspect-video overflow-hidden">
                  <img src={b.img} alt={b.title} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-6">
                  <h3 className="font-extrabold text-lg sm:text-xl mb-3">{b.title}</h3>
                  <p className="text-sm sm:text-base text-white/75">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GARANTIA */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-[#0b0b0d] to-[#14070f]">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[auto,1fr] gap-8 items-center">
            <img src={garantia} alt="Garantia 15 dias" loading="lazy" className="h-72 w-72 sm:h-80 sm:w-80 mx-auto -mb-6 md:mb-0" />
            <div className="text-center md:text-left">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
                Confiamos em nosso <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">MÉTODO</span>
              </h2>
              <ShieldCheck className="h-8 w-8 text-lime-400 mx-auto md:mx-0 mb-3" />
              <p className="text-base sm:text-lg text-white/85">
                Se em até <strong className="text-lime-300">15 dias</strong> você não ficar satisfeito com o curso, nos mande um e-mail e iremos te reembolsar completamente. Sem enganação e sem enrolação — <strong>garantia 100%</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OFERTA — frase resumo + preço + CTA */}
      <section id="oferta" className="scroll-mt-4 pt-6 pb-16 sm:pt-8 sm:pb-24 bg-gradient-to-br from-[#1a0612] via-[#0b0b0d] to-[#0a0a14]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 shadow-2xl p-6 sm:p-10 backdrop-blur">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-6">
              Você vai <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">aprender:</span>
            </h2>

            <p className="text-center text-base sm:text-lg text-white/85 leading-relaxed mb-4 max-w-2xl mx-auto">
              <strong>Caipirinhas perfeitas</strong>, <strong>drinks clássicos</strong> do mundo todo, <strong>drinks gigantes</strong> em jarras e suqueiras, <strong>shots</strong> para curtir com a galera, batidas, frozens, drinks em camadas — além de proporções, utensílios, taças, ingredientes essenciais e tudo o que faz um drink ser memorável.
            </p>

            <div className="text-center mb-6">
              {isVip ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-400/40 mb-3">
                    <Crown className="h-4 w-4 text-amber-300" />
                    <span className="text-sm font-bold text-amber-200 uppercase tracking-wide">
                      Preço exclusivo VIP · {VIP_DISCOUNT_PERCENT}% OFF
                    </span>
                  </div>
                  <p className="text-lg text-white/60 line-through">{formatBRL(basePrice)}</p>
                  <p className="text-sm uppercase tracking-wider text-white/70 mt-2">por apenas</p>
                  <p className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent my-2">
                    {formatBRL(finalPrice)}
                  </p>
                  <p className="text-base text-white/80">
                    em até <strong className="text-amber-300">12x R$ {installments}</strong>
                  </p>
                  <p className="text-xs text-amber-300/90 mt-2">
                    Esse valor especial é só para você que já é assinante VIP. 💜
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg text-white/60 line-through">De R$ 1.439,00</p>
                  <p className="text-sm uppercase tracking-wider text-white/70 mt-2">por apenas</p>
                  <p className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent my-2">
                    {formatBRL(finalPrice)}
                  </p>
                  <p className="text-base text-white/80">
                    em até <strong className="text-amber-300">12x R$ {installments}</strong>
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-center mb-6">
              <button
                onClick={handleBuy}
                disabled={checkoutLoading}
                className="dx-cta dx-cta-green group relative inline-flex items-center justify-center gap-3 rounded-full px-8 sm:px-12 py-5 sm:py-6 font-extrabold text-white text-lg sm:text-xl overflow-hidden isolate transition-transform duration-300 hover:scale-[1.03] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="dx-cta-liquid" aria-hidden="true" />
                {checkoutLoading ? (
                  <span className="relative z-10 inline-flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                    <Loader2 className="h-6 w-6 animate-spin" /> Abrindo checkout...
                  </span>
                ) : (
                  <span className="relative z-10 inline-flex items-center gap-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                    <Check className="h-16 w-16 sm:h-20 sm:w-20" strokeWidth={3} /> MATRICULE-SE! ACESSO INSTANTÂNEO
                  </span>
                )}
              </button>
            </div>

            <img src={pagamentos} alt="Formas de pagamento" loading="lazy" className="w-full max-w-md mx-auto opacity-90" />

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-lime-400" /> Garantia de 15 dias</span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-lime-400" /> Acesso de 1 ano</span>
              <span className="hidden sm:inline text-white/30">•</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-lime-400" /> Pagamento seguro via Stripe</span>
            </div>

            <div className="mt-8 text-center text-sm text-white/60">
              Já é aluno? <Link to="/login" className="text-amber-300 hover:text-amber-200 underline">Acesse aqui</Link>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE BRUNO — agora com a foto transparente do hero */}
      <section className="relative py-16 sm:py-24 overflow-hidden bg-gradient-to-b from-[#0b0b0d] via-[#150810] to-[#0b0b0d]">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(50% 50% at 20% 50%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(50% 50% at 80% 50%, rgba(236,72,153,0.18), transparent 60%)',
          }}
        />
        <div className="container mx-auto px-4 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-center mb-12">
            Quem é <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">Bruno Abreu?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
            <div className="flex justify-center">
              <img
                src={brunoHero}
                alt="Bruno Abreu"
                loading="lazy"
                className="max-h-[60vh] w-auto object-contain drop-shadow-[0_20px_50px_rgba(236,72,153,0.35)]"
              />
            </div>
            <div className="space-y-4 text-base sm:text-lg text-white/85">
              <p>Fundador da Drinkeros, <strong className="text-amber-300">o maior canal de receitas de drinks</strong> em vídeo da América Latina.</p>
              <p>Bruno trabalha com desenvolvimento de projetos para internet desde seus 12 anos de idade, é web-designer, editor de vídeo, roteirista, humorista e drinkero.</p>
              <p><strong>Um completo apaixonado por drinks</strong>, que transformou seu aprendizado com drinks em uma experiência online única e inovadora.</p>
              <p>O canal Drinkeros possui <strong className="text-amber-300">mais de 6 milhões de seguidores</strong> em toda América Latina e já conta com <strong>mais de 2 mil receitas criadas</strong> utilizando seu Método Áureo das proporções dos drinks.</p>
              <p>Em 2020, Bruno criou o curso de drinks mais divertido da internet. O <strong className="text-amber-300">Drinkeros Xperience</strong>, que hoje já certificou <strong>mais de 11.000 alunos</strong> pelo mundo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-[#0b0b0d] to-[#14070f]">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-4">
            Tire todas suas <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">dúvidas!</span>
          </h2>
          <p className="text-center text-white/70 mb-10">
            Caso ainda tenha alguma dúvida, fale com a gente pelo WhatsApp.
          </p>
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`q-${i}`}
                className="rounded-xl bg-white/5 border border-white/10 px-5 data-[state=open]:border-pink-500/40"
              >
                <AccordionTrigger className="text-left font-semibold text-white hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-white/80">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="flex justify-center mt-12">
            <CTAButton size="xl">QUERO COMEÇAR</CTAButton>
          </div>
        </div>
      </section>

      {/* SUPORTE WHATSAPP */}
      <section className="py-16 bg-[#0b0b0d]">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">Ainda possui dúvidas?</h3>
          <p className="text-white/70 mb-6">Fale conosco imediatamente através do WhatsApp</p>
          <a
            href="https://wa.me/5548991601025?text=Ol%C3%A1!%20Preciso%20de%20ajuda."
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
        <p className="text-sm text-white/50">© {new Date().getFullYear()} Drinkeros — Todos os direitos reservados</p>
      </footer>
    </div>
  );
};

export default DrinkerosXperience;
