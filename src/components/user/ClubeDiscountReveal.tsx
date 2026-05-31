import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import giftBody from '@/assets/gift-box-body.png';
import giftLid from '@/assets/gift-box-lid.png';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase =
  | 'idle'
  | 'intro'      // gift box + "O que tem dentro?" + botão "Ver oferta!"
  | 'lidOff'    // tampa voa pra cima
  | 'won'
  | 'amount'
  | 'discount'
  | 'hold'
  | 'out';

/**
 * Overlay cinematográfico em duas partes:
 *  1) INTRO: presente brilhante entra na tela, com "O que tem dentro?" e botão.
 *  2) REVEAL: ao clicar, a tampa voa e revela "Você ganhou R$100 de desconto."
 */
export const ClubeDiscountReveal: React.FC<Props> = ({ open, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const onCloseRef = React.useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const timersRef = React.useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      clearTimers();
      return;
    }
    setPhase('intro');
    return () => clearTimers();
  }, [open]);

  const startReveal = () => {
    if (phase !== 'intro') return;
    clearTimers();
    setPhase('lidOff');
    const t1 = window.setTimeout(() => setPhase('won'), 650);
    const t2 = window.setTimeout(() => setPhase('amount'), 650 + 400);
    const t3 = window.setTimeout(() => setPhase('discount'), 650 + 1350);
    const t4 = window.setTimeout(() => setPhase('hold'), 650 + 2000);
    const t5 = window.setTimeout(() => setPhase('out'), 650 + 4350);
    const t6 = window.setTimeout(() => onCloseRef.current(), 650 + 4950);
    timersRef.current.push(t1, t2, t3, t4, t5, t6);
  };

  const handleClose = () => {
    clearTimers();
    setPhase('out');
    window.setTimeout(() => onCloseRef.current(), 350);
  };

  // Sparkles para fundo (ambiente, contínuos)
  const bgSparkles = React.useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        key: i,
        left: `${(i * 47) % 100}%`,
        top: `${(i * 73) % 100}%`,
        size: 4 + (i % 4) * 3,
        delay: (i * 137) % 2200,
        dur: 1800 + (i % 5) * 400,
      })),
    [],
  );

  // Sparkles que explodem no momento do "amount"
  const sparkles = React.useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.16);
        const dist = 72 + (i % 3) * 28;
        return {
          key: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          delay: (i % 5) * 28,
          size: 9 + (i % 3) * 4,
        };
      }),
    [],
  );

  // Evita um frame preto no Safari: quando `open` vira true, mostramos a intro
  // imediatamente, sem esperar o useEffect atualizar `phase`.
  const activePhase: Phase = open && phase === 'idle' ? 'intro' : phase;
  const showAmount = ['amount', 'discount', 'hold'].includes(activePhase);
  const showDiscount = ['discount', 'hold'].includes(activePhase);
  const showWon = ['won', 'amount', 'discount', 'hold'].includes(activePhase);
  const isRevealing = ['lidOff', 'won', 'amount', 'discount', 'hold'].includes(activePhase);
  const isIntro = activePhase === 'intro';

  if (!open && phase === 'idle') return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5 overflow-hidden"
      style={{
        opacity: activePhase === 'out' ? 0 : 1,
        transition: 'opacity 420ms ease',
        transform: 'translateZ(0)',
      }}
      aria-live="polite"
    >
      {/* Backdrop com degradê vivo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, hsl(310 55% 27%) 0%, hsl(280 70% 13%) 45%, hsl(260 70% 5%) 100%)',
        }}
      />
      {/* brilho rosa pulsante */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, hsl(var(--primary) / 0.32) 0%, transparent 55%)',
          animation: 'clube-bg-pulse 3.6s ease-in-out infinite',
        }}
      />

      {/* Estrelinhas de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        {bgSparkles.map((s) => (
          <span
            key={s.key}
            className="absolute rounded-full"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              background:
                'radial-gradient(circle, hsl(var(--foreground)) 0%, hsl(var(--foreground) / 0.55) 50%, transparent 100%)',
              boxShadow: '0 0 8px hsl(var(--foreground) / 0.8), 0 0 12px hsl(var(--primary) / 0.45)',
              animation: `clube-twinkle ${s.dur}ms ease-in-out ${s.delay}ms infinite`,
            }}
          />
        ))}
      </div>

      {/* Botão fechar (sempre visível durante intro/reveal) */}
      {activePhase !== 'out' && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute top-5 right-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* ===== INTRO: gift box ===== */}
      {isIntro && (
        <div className="relative z-[1] w-full max-w-[380px] text-center select-none">
          <div
            className="text-white text-base sm:text-lg font-bold tracking-wide px-2"
            style={{
              animation: 'clube-fade-up 520ms ease 80ms both',
              textShadow: '0 2px 18px rgba(236,72,153,0.55)',
            }}
          >
            SUPER OFERTA PARA <span className="text-yellow-300">NOVOS CADASTRADOS!</span>
          </div>

          <div className="relative mx-auto mt-7 mb-6 h-[300px] sm:h-[340px] w-full">
            {/* Faixos de luz girando atrás do presente */}
            {[
              { w: 540, h: 10, dur: '7s', dir: 'normal', op: 0.55, delay: '0s', color: 'hsl(320 95% 65%)' },
              { w: 600, h: 8, dur: '11s', dir: 'reverse', op: 0.4, delay: '-2s', color: 'hsl(280 90% 70%)' },
              { w: 500, h: 14, dur: '9s', dir: 'normal', op: 0.35, delay: '-4s', color: 'hsl(45 95% 70%)' },
            ].map((b, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 pointer-events-none"
                style={{
                  width: b.w,
                  height: b.h,
                  marginLeft: -b.w / 2,
                  marginTop: -b.h / 2,
                  background: `radial-gradient(ellipse at center, ${b.color} 0%, transparent 75%)`,
                  opacity: b.op,
                  filter: 'blur(2px)',
                  animation: `clube-beam-spin ${b.dur} linear ${b.delay} infinite`,
                  animationDirection: b.dir as any,
                  mixBlendMode: 'screen',
                }}
              />
            ))}

            {/* Glow atrás do presente */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[260px] w-[260px] rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, hsl(var(--primary) / 0.45) 0%, hsl(280 70% 55% / 0.2) 48%, transparent 72%)',
                animation: 'clube-glow-pulse 2.2s ease-in-out infinite',
              }}
            />

            {/* Explosão de estrelas ao aparecer */}
            {sparkles.map((s) => (
              <span
                key={`burst-${s.key}`}
                className="absolute left-1/2 top-1/2 block rounded-full pointer-events-none"
                style={{
                  width: s.size,
                  height: s.size,
                  background:
                    'radial-gradient(circle, #fff 0%, hsl(45 95% 70%) 55%, transparent 100%)',
                  boxShadow: '0 0 16px hsl(45 95% 70% / 0.95)',
                  '--sparkle-x': `${s.x * 1.7}px`,
                  '--sparkle-y': `${s.y * 1.7}px`,
                  opacity: 0,
                  animation: `clube-sparkle 1100ms cubic-bezier(.16,1,.3,1) ${300 + s.delay}ms forwards`,
                } as React.CSSProperties}
              />
            ))}

            {/* Corpo */}
            <img
              src={giftBody}
              alt=""
              width={512}
              height={512}
              decoding="async"
              className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 h-[200px] sm:h-[230px] w-auto"
              style={{ animation: 'clube-gift-in 720ms cubic-bezier(.18,1.5,.3,1) 200ms both' }}
            />
            {/* Tampa */}
            <img
              src={giftLid}
              alt=""
              width={512}
              height={512}
              decoding="async"
              className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 h-[165px] sm:h-[190px] w-auto"
              style={{
                animation:
                  'clube-gift-in 720ms cubic-bezier(.18,1.5,.3,1) 320ms both, clube-lid-bob 2.4s ease-in-out 1100ms infinite',
              }}
            />
          </div>

          <div
            className="text-white text-2xl sm:text-3xl font-light tracking-wide"
            style={{ animation: 'clube-fade-up 520ms ease 480ms both' }}
          >
            O que tem dentro?
          </div>

          <button
            type="button"
            onClick={startReveal}
            className="mt-7 inline-flex items-center justify-center rounded-full px-9 py-3.5 text-primary-foreground font-bold text-lg hover:scale-[1.03] active:scale-[0.98] transition-transform"
            style={{
              backgroundImage:
                'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(350 90% 58%) 25%, hsl(45 95% 65%) 50%, hsl(350 90% 58%) 75%, hsl(var(--primary)) 100%)',
              backgroundSize: '300% 100%',
              boxShadow: '0 10px 26px hsl(var(--primary) / 0.55), 0 0 40px hsl(var(--primary) / 0.4)',
              animation:
                'clube-fade-up 520ms ease 640ms both, clube-btn-shimmer 2.6s linear 1100ms infinite, clube-btn-glow 2.2s ease-in-out 1100ms infinite',
            }}
          >
            Ver oferta!
          </button>
        </div>
      )}

      {/* ===== REVEAL ===== */}
      {isRevealing && (
        <div className="relative z-[1] w-full max-w-[360px] px-5 py-6 text-center select-none">
          {/* Tampa voando pra cima durante lidOff (atrás do conteúdo) */}
          <img
            src={giftLid}
            alt=""
            aria-hidden
            width={512}
            height={512}
            decoding="async"
            className="pointer-events-none absolute left-1/2 top-[10%] -translate-x-1/2 h-[150px] w-auto"
            style={{
              animation: 'clube-lid-off 700ms cubic-bezier(.4,.0,.2,1) forwards',
            }}
          />

          {/* "Você ganhou" */}
          <div
            className="text-white text-2xl sm:text-3xl font-light tracking-wide"
            style={{
              opacity: showWon ? 1 : 0,
              transform: showWon ? 'translateY(0)' : 'translateY(18px)',
              transition: 'opacity 450ms ease, transform 450ms ease',
            }}
          >
            Você ganhou
          </div>

          {/* "R$100" com sparkles */}
          <div className="relative my-6 sm:my-8 flex items-center justify-center">
            {sparkles.map((s) => (
              <span
                key={s.key}
                className="absolute left-1/2 top-1/2 block rounded-full"
                style={{
                  width: s.size,
                  height: s.size,
                  background:
                    'radial-gradient(circle, hsl(45 95% 70%) 0%, hsl(40 90% 55%) 60%, transparent 100%)',
                  boxShadow:
                    '0 0 22px hsl(45 95% 70% / 0.95), 0 0 6px hsl(45 95% 85% / 0.9)',
                  '--sparkle-x': `${s.x}px`,
                  '--sparkle-y': `${s.y}px`,
                  opacity: 0,
                  animation:
                    activePhase === 'amount'
                      ? `clube-sparkle 900ms cubic-bezier(.16,1,.3,1) ${s.delay}ms forwards`
                      : 'none',
                } as React.CSSProperties}
              />
            ))}
            <div
              className="text-6xl sm:text-7xl md:text-8xl font-black"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #f5d76e 0%, #f1c40f 35%, #c69214 65%, #8a6a14 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                transform: showAmount ? 'scale(1)' : 'scale(0)',
                opacity: showAmount ? 1 : 0,
                transition: showAmount
                  ? 'transform 680ms cubic-bezier(.08,1.65,.22,1), opacity 160ms ease'
                  : 'opacity 400ms ease',
                filter: 'drop-shadow(0 0 32px rgba(241,196,15,0.58))',
              }}
            >
              R$ 100
            </div>
          </div>

          {/* "de desconto." */}
          <div
            className="text-white text-2xl sm:text-3xl font-light tracking-wide"
            style={{
              opacity: showDiscount ? 1 : 0,
              transform: showDiscount ? 'translateY(0)' : 'translateY(18px)',
              transition: 'opacity 450ms ease, transform 450ms ease',
            }}
          >
            de desconto.
          </div>
        </div>
      )}

      <style>{`
        @keyframes clube-sparkle {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
          12% { opacity: 1; }
          60% { opacity: 1; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--sparkle-x)), calc(-50% + var(--sparkle-y))) scale(0.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
        }
        @keyframes clube-fade-up {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes clube-gift-in {
          0% { opacity: 0; transform: translate(-50%, -10%) scale(0.4) rotate(-8deg); }
          70% { opacity: 1; }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        }
        @keyframes clube-lid-bob {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
        }
        @keyframes clube-lid-off {
          0% { opacity: 1; transform: translateX(-50%) translateY(0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-220px) rotate(-22deg) scale(0.7); }
        }
        @keyframes clube-glow-pulse {
          0%, 100% { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes clube-bg-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes clube-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes clube-btn-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default ClubeDiscountReveal;
