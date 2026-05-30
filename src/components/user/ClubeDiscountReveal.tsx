import React, { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Overlay cinematográfico que anuncia o desconto de R$100.
 * Sequência:
 *  0.0s  "Você ganhou" fade-in + slide-up
 *  0.7s  "R$100" cresce do zero com spring + sparkles dourados explodindo
 *  1.8s  "de desconto." fade-in
 *  3.8s  fade-out completo
 *  4.4s  onClose()
 */
export const ClubeDiscountReveal: React.FC<Props> = ({ open, onClose }) => {
  const [phase, setPhase] = useState<'idle' | 'in' | 'out'>('idle');

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      return;
    }
    setPhase('in');
    const tOut = window.setTimeout(() => setPhase('out'), 3800);
    const tClose = window.setTimeout(() => onClose(), 4400);
    return () => {
      window.clearTimeout(tOut);
      window.clearTimeout(tClose);
    };
  }, [open, onClose]);

  if (!open && phase === 'idle') return null;

  // 14 sparkles em direções aleatórias mas determinísticas
  const sparkles = Array.from({ length: 14 }).map((_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.2);
    const dist = 140 + (i % 3) * 40;
    return {
      key: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      delay: 700 + (i % 5) * 40,
    };
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
      style={{
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 600ms ease',
      }}
      aria-live="polite"
    >
      <div className="relative text-center px-6 select-none">
        {/* "Você ganhou" */}
        <div
          className="text-white text-2xl sm:text-3xl font-light tracking-wide"
          style={{
            opacity: phase === 'in' ? 1 : 0,
            transform: phase === 'in' ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 600ms ease 100ms, transform 600ms ease 100ms',
          }}
        >
          Você ganhou
        </div>

        {/* "R$100" com sparkles */}
        <div className="relative my-6 sm:my-8 flex items-center justify-center">
          {sparkles.map((s) => (
            <span
              key={s.key}
              className="absolute left-1/2 top-1/2 block h-2 w-2 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, hsl(45 95% 70%) 0%, hsl(40 90% 55%) 60%, transparent 100%)',
                boxShadow: '0 0 12px hsl(45 95% 70% / 0.9)',
                transform:
                  phase === 'in'
                    ? `translate(calc(-50% + ${s.x}px), calc(-50% + ${s.y}px)) scale(0)`
                    : 'translate(-50%, -50%) scale(0)',
                opacity: phase === 'in' ? 0 : 0,
                animation:
                  phase === 'in'
                    ? `clube-sparkle 1100ms ease-out ${s.delay}ms forwards`
                    : 'none',
              }}
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
              transform:
                phase === 'in' ? 'scale(1)' : 'scale(0)',
              opacity: phase === 'in' ? 1 : 0,
              transition:
                phase === 'in'
                  ? 'transform 800ms cubic-bezier(.34,1.56,.64,1) 700ms, opacity 400ms ease 700ms'
                  : 'opacity 400ms ease',
              filter: 'drop-shadow(0 0 30px rgba(241,196,15,0.4))',
            }}
          >
            R$100
          </div>
        </div>

        {/* "de desconto." */}
        <div
          className="text-white text-2xl sm:text-3xl font-light tracking-wide"
          style={{
            opacity: phase === 'in' ? 1 : 0,
            transform: phase === 'in' ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 600ms ease 1800ms, transform 600ms ease 1800ms',
          }}
        >
          de desconto.
        </div>
      </div>

      <style>{`
        @keyframes clube-sparkle {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0);
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: var(--sparkle-end);
          }
        }
      `}</style>
    </div>
  );
};

export default ClubeDiscountReveal;
