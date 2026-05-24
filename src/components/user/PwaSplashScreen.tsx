import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectStandalone } from '@/hooks/usePwaStatus';
import drinkerosLogo from '@/assets/logotipo-drinkeros.png';

const SESSION_KEY = 'pwa-splash-shown';

export const PwaSplashScreen: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (!detectStandalone()) return false;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return false;
    return true;
  });
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem(SESSION_KEY, '1');
      setFadingOut(true);
      setTimeout(() => setVisible(false), 320);
    };

    // Prefetch das 5 primeiras receitas
    supabase
      .from('recipes')
      .select('id')
      .limit(5)
      .then(() => {
        // Garante tempo mínimo da animação do logo (~900ms)
        setTimeout(finish, 900);
      });

    // Timeout de segurança
    const safety = setTimeout(finish, 3500);
    return () => clearTimeout(safety);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Carregando Drinkeros"
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background overflow-hidden transition-opacity duration-300 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Ondas de fundo */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-[18vh]">
        <SplashWave className="animate-splash-wave-slow opacity-20" />
        <SplashWave className="animate-splash-wave-med opacity-15" />
        <SplashWave className="animate-splash-wave-fast opacity-25" />
      </div>

      {/* Logo */}
      <img
        src={drinkerosLogo}
        alt="Drinkeros"
        className="relative z-10 w-[50vw] md:w-[20vw] max-w-[260px] h-auto animate-splash-logo"
        draggable={false}
      />
    </div>
  );
};

const SplashWave: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`relative w-full h-[2px] overflow-hidden ${className ?? ''}`}>
    <div className="absolute inset-y-0 left-0 w-[200%] flex">
      <WaveSvg />
      <WaveSvg />
    </div>
  </div>
);

const WaveSvg: React.FC = () => (
  <svg
    viewBox="0 0 1200 20"
    preserveAspectRatio="none"
    className="w-1/2 h-[20px] -mt-[9px] text-muted-foreground"
    aria-hidden="true"
  >
    <path
      d="M0 10 Q 75 0 150 10 T 300 10 T 450 10 T 600 10 T 750 10 T 900 10 T 1050 10 T 1200 10"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);
