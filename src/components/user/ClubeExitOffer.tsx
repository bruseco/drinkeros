import React, { useEffect, useState } from 'react';
import { GlassWater, ShieldCheck, Loader2 } from 'lucide-react';

interface ClubeExitOfferProps {
  open: boolean;
  loading?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

const SPARK_COUNT = 28;

const sparks = Array.from({ length: SPARK_COUNT }).map((_, i) => {
  const angle = (360 / SPARK_COUNT) * i + (Math.random() * 12 - 6);
  const distance = 110 + Math.random() * 140;
  const delay = Math.random() * 120;
  const size = 4 + Math.random() * 6;
  const hue = Math.random() > 0.4 ? 48 : 32; // gold / amber
  return { angle, distance, delay, size, hue };
});

const ClubeExitOffer: React.FC<ClubeExitOfferProps> = ({ open, loading, onAccept, onDismiss }) => {
  const [showGlass, setShowGlass] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowGlass(false);
      return;
    }
    const t = window.setTimeout(() => setShowGlass(true), 650);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5 py-8 bg-black/85 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes clube-spark-burst {
          0% { transform: translate(-50%, -50%) rotate(var(--a)) translateX(0) scale(0.4); opacity: 0; }
          12% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--d)) scale(0); opacity: 0; }
        }
        @keyframes clube-glass-pop {
          0% { transform: scale(0.4) rotate(-12deg); opacity: 0; filter: drop-shadow(0 0 0 rgba(250,204,21,0)); }
          55% { transform: scale(1.15) rotate(4deg); opacity: 1; }
          80% { transform: scale(0.96) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; filter: drop-shadow(0 0 24px rgba(250,204,21,0.65)); }
        }
        @keyframes clube-card-rise {
          0% { transform: translateY(28px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes clube-gold-glow {
          0%, 100% { box-shadow: 0 0 20px 0 rgba(250, 204, 21, 0.45), 0 0 40px 0 rgba(250, 204, 21, 0.25); }
          50% { box-shadow: 0 0 35px 6px rgba(250, 204, 21, 0.85), 0 0 70px 12px rgba(250, 204, 21, 0.5); }
        }
      `}</style>

      <div className="relative w-full max-w-sm">
        {/* Spark burst */}
        <div className="pointer-events-none absolute left-1/2 top-[88px] -translate-x-1/2 w-0 h-0">
          {sparks.map((s, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: s.size,
                height: s.size,
                background: `hsl(${s.hue} 95% 60%)`,
                boxShadow: `0 0 8px hsl(${s.hue} 95% 65%)`,
                ['--a' as any]: `${s.angle}deg`,
                ['--d' as any]: `${s.distance}px`,
                animation: `clube-spark-burst 900ms ${s.delay}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
              }}
            />
          ))}
        </div>

        {/* Glass icon */}
        <div className="flex items-center justify-center mb-6 h-[180px]">
          {showGlass && (
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600"
              style={{ animation: 'clube-glass-pop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            >
              <GlassWater className="w-14 h-14 text-black" strokeWidth={2.2} />
            </div>
          )}
        </div>

        {/* Card */}
        <div
          className="relative rounded-2xl border border-yellow-400/40 bg-gradient-to-b from-purple-900/95 to-black p-6 text-center text-white shadow-2xl"
          style={{ animation: 'clube-card-rise 500ms 250ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <p className="uppercase tracking-widest text-[11px] font-bold text-yellow-300 mb-2">
            Espera! 🥃
          </p>
          <h2 className="text-2xl font-extrabold leading-tight mb-3">
            Você ganhou mais{' '}
            <span className="text-yellow-300">R$ 28 de desconto</span>
          </h2>
          <p className="text-purple-100 text-[15px] leading-snug mb-4">
            Aproveite agora! É o melhor momento pra você se tornar{' '}
            <strong className="text-white">Sócio do Clube</strong> por apenas{' '}
            <strong className="text-yellow-300">R$ 69/ano</strong>.
          </p>
          <p className="text-purple-200 italic text-sm mb-6">
            Esse preço está sexy e irresistível. 🔥
          </p>

          <button
            onClick={onAccept}
            disabled={loading}
            className="w-full rounded-xl py-4 px-5 font-extrabold text-black text-base bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-500 disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ animation: 'clube-gold-glow 2200ms ease-in-out infinite' }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Liberando...
              </>
            ) : (
              'Quero aproveitar'
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-purple-200/80">
            <ShieldCheck className="w-3.5 h-3.5" /> pagamento seguro · acesso imediato
          </div>

          <button
            onClick={onDismiss}
            disabled={loading}
            className="mt-4 w-full text-xs text-purple-300/70 hover:text-purple-200 underline underline-offset-2 disabled:opacity-50"
          >
            Prefiro perder a melhor oferta da Drinkeros.
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClubeExitOffer;
