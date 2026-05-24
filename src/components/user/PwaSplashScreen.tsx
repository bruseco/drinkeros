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
      {/* Ondas de fundo - curvas grandes, looping em velocidades diferentes */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-stretch justify-center gap-8">
        <SplashWave speedClass="animate-splash-wave-slow" opacityClass="opacity-25" amplitude={70} />
        <SplashWave speedClass="animate-splash-wave-med" opacityClass="opacity-20" amplitude={110} />
        <SplashWave speedClass="animate-splash-wave-fast" opacityClass="opacity-30" amplitude={55} />
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

const SplashWave: React.FC<{ speedClass: string; opacityClass: string; amplitude: number }> = ({
  speedClass,
  opacityClass,
  amplitude,
}) => {
  const h = amplitude * 2 + 6;
  return (
    <div className={`relative w-full overflow-hidden ${opacityClass} ${speedClass}`} style={{ height: `${h}px` }}>
      <div className="absolute inset-y-0 left-0 w-[400%] flex">
        <WaveSvg amplitude={amplitude} />
        <WaveSvg amplitude={amplitude} />
      </div>
    </div>
  );
};

const WaveSvg: React.FC<{ amplitude: number }> = ({ amplitude }) => {
  const h = amplitude * 2 + 6;
  const mid = h / 2;
  const a = amplitude;
  // Curvas largas e suaves ao longo de 2400 unidades
  const d = `M0 ${mid} C 400 ${mid - a}, 800 ${mid + a}, 1200 ${mid} S 2000 ${mid - a}, 2400 ${mid}`;
  return (
    <svg
      viewBox={`0 0 2400 ${h}`}
      preserveAspectRatio="none"
      className="w-1/2 h-full text-muted-foreground"
      aria-hidden="true"
    >
      <path d={d} stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
};
