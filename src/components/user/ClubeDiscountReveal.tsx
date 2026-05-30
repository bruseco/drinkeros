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
  const [phase, setPhase] = useState<'idle' | 'won' | 'amount' | 'discount' | 'hold' | 'out'>('idle');

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      return;
    }
    setPhase('won');
    const tAmount = window.setTimeout(() => setPhase('amount'), 700);
    const tDiscount = window.setTimeout(() => setPhase('discount'), 1650);
    const tHold = window.setTimeout(() => setPhase('hold'), 2300);
    const tOut = window.setTimeout(() => setPhase('out'), 4650);
    const tClose = window.setTimeout(() => onClose(), 5250);
    return () => {
      window.clearTimeout(tAmount);
      window.clearTimeout(tDiscount);
      window.clearTimeout(tHold);
      window.clearTimeout(tOut);
      window.clearTimeout(tClose);
    };
  }, [open, onClose]);

  if (!open && phase === 'idle') return null;

  const sparkles = Array.from({ length: 22 }).map((_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.16);
    const dist = 72 + (i % 4) * 34;
    return {
      key: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      delay: (i % 5) * 28,
      size: 4 + (i % 3) * 2,
    };
  });

  const showAmount = ['amount', 'discount', 'hold'].includes(phase);
  const showDiscount = ['discount', 'hold'].includes(phase);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/58 px-5"
      style={{
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 600ms ease',
      }}
      aria-live="polite"
    >
      <div className="relative w-full max-w-[360px] px-5 py-12 text-center select-none">
        {/* "Você ganhou" */}
        <div
          className="text-white text-2xl sm:text-3xl font-light tracking-wide"
          style={{
            opacity: ['won', 'amount', 'discount', 'hold'].includes(phase) ? 1 : 0,
            transform: ['won', 'amount', 'discount', 'hold'].includes(phase) ? 'translateY(0)' : 'translateY(18px)',
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
              className="absolute left-1/2 top-1/2 block h-2 w-2 rounded-full"
              style={{
                width: s.size,
                height: s.size,
                background:
                  'radial-gradient(circle, hsl(45 95% 70%) 0%, hsl(40 90% 55%) 60%, transparent 100%)',
                boxShadow: '0 0 12px hsl(45 95% 70% / 0.9)',
                '--sparkle-x': `${s.x}px`,
                '--sparkle-y': `${s.y}px`,
                opacity: 0,
                animation:
                  phase === 'amount'
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
              transition:
                showAmount
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

      <style>{`
        @keyframes clube-sparkle {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0);
          }
          12% { opacity: 1; }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--sparkle-x)), calc(-50% + var(--sparkle-y))) scale(0.15);
          }
        }
      `}</style>
    </div>
  );
};

export default ClubeDiscountReveal;
