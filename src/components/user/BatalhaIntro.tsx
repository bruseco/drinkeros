import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Trophy, Star, Crown, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logotipo-batalha-dos-drinkeros-branco.png';

const STORAGE_KEY = 'batalha_intro_seen_v1';

interface Props {
  onFinish: () => void;
  initialStage?: 'loading' | 'explainer';
  showCloseButton?: boolean;
  persistOnFinish?: boolean;
}

export const BatalhaIntro: React.FC<Props> = ({ onFinish, initialStage = 'loading', showCloseButton = false, persistOnFinish = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<'loading' | 'video' | 'explainer'>(initialStage);
  const [showSkip, setShowSkip] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const showExplainer = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    setStage('explainer');
  };

  useEffect(() => {
    if (initialStage === 'explainer') return;
    const v = videoRef.current;
    if (!v) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      setStage('video');
      v.muted = true;
      v.play().catch(() => {});
    };
    v.addEventListener('loadeddata', start);
    v.addEventListener('canplay', start);
    v.addEventListener('ended', showExplainer);
    const fallback = setTimeout(start, 2500);
    return () => {
      v.removeEventListener('loadeddata', start);
      v.removeEventListener('canplay', start);
      v.removeEventListener('ended', showExplainer);
      clearTimeout(fallback);
    };
  }, []);

  const enableSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    setIsMuted(false);
    v.play().catch(() => {});
  };

  useEffect(() => {
    if (stage !== 'video') return;
    const t = setTimeout(() => setShowSkip(true), 5000);
    return () => clearTimeout(t);
  }, [stage]);

  const handleFinish = () => {
    if (persistOnFinish) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    }
    onFinish();
  };

  if (stage === 'explainer') {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-neutral-950 via-orange-950 to-neutral-950">
        {showCloseButton && (
          <button
            onClick={handleFinish}
            aria-label="Fechar"
            className="fixed top-4 right-4 z-[110] h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-white flex items-center justify-center shadow-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 text-white max-w-xl mx-auto">
          <img src={logo} alt="Batalha dos Drinkeros" className="w-64 max-w-full mb-6 drop-shadow-2xl" />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Crown className="h-3 w-3" /> Exclusivo Assinante VIP
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">Como funciona</h1>
          <p className="text-center text-white/80 mb-6">
            Poste suas receitas, vote nas dos outros e suba no ranking.
          </p>

          <div className="w-full space-y-3 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10">
              <Sparkles className="h-5 w-5 text-pink-300 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">+5 pontos</p>
                <p className="text-xs text-white/70">por cada receita publicada</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10">
              <Star className="h-5 w-5 text-yellow-300 shrink-0 fill-yellow-300" />
              <div className="flex-1">
                <p className="font-semibold">+1 ponto</p>
                <p className="text-xs text-white/70">por voto que você dá em outras receitas</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10">
              <Trophy className="h-5 w-5 text-amber-300 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">+10 pontos</p>
                <p className="text-xs text-white/70">por voto recebido na sua receita</p>
              </div>
            </div>
          </div>

          <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4 mb-8">
            <p className="text-sm text-center text-white/90">
              🏆 Todo mês, a receita com a <strong>maior média de avaliação</strong> vence e é destacada para todos os Drinkeros.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs">
            <span className="px-3 py-1 rounded-full bg-amber-700/40 border border-amber-500/40">🥉 Bronze</span>
            <span className="px-3 py-1 rounded-full bg-slate-400/30 border border-slate-300/40">🥈 Prata 50+</span>
            <span className="px-3 py-1 rounded-full bg-yellow-500/30 border border-yellow-400/40">🥇 Ouro 200+</span>
            <span className="px-3 py-1 rounded-full bg-fuchsia-500/30 border border-fuchsia-400/40">👑 Mestre 500+</span>
          </div>

          <Button
            size="lg"
            onClick={handleFinish}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold uppercase tracking-wide shadow-lg"
          >
            Entrar na Batalha
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-black" />

      {stage === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-20">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm text-white/70">Preparando a Batalha...</p>
        </div>
      )}

      <video
        ref={videoRef}
        src="/vinheta-batalha-dos-drinkeros-web.mp4"
        className="relative z-10 w-full h-full object-contain"
        playsInline
        muted
        autoPlay
        preload="metadata"
        poster="/batalha-video-poster.jpg"
      />

      {stage === 'video' && isMuted && (
        <button
          onClick={enableSound}
          className="absolute top-6 left-6 z-30 px-4 py-2 rounded-full bg-white/15 border border-white/30 text-white text-xs font-bold uppercase tracking-wide shadow-xl"
        >
          🔊 Ativar som
        </button>
      )}

      {stage === 'video' && showSkip && (
        <button
          onClick={showExplainer}
          className="absolute top-6 right-6 z-30 px-5 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm uppercase tracking-wide shadow-xl animate-fade-in transition-colors"
          style={{ animation: 'fadeIn 0.6s ease-in forwards' }}
        >
          Pular intro
        </button>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export const hasSeenBatalhaIntro = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};
