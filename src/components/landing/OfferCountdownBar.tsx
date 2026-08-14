import React, { useEffect, useState } from 'react';

interface Props {
  /** Timestamp (ms) em que a contagem começou. */
  startedAt: number;
  /** Duração total em minutos. */
  minutes?: number;
  /** Texto exibido ao lado do timer. */
  label?: string;
  /** Some quando o tempo acaba. */
  hideOnEnd?: boolean;
  /** Controla se a tarja está visível. Quando muda de false para true, desliza de cima. */
  visible?: boolean;
}

const two = (n: number) => String(Math.max(0, n)).padStart(2, '0');

/**
 * Tarja fixa no topo com contagem regressiva da oferta.
 * Usada nas páginas de venda após a revelação do desconto.
 * Aparece deslizando de cima para baixo e o label pisca em amarelo por 8s.
 */
export const OfferCountdownBar: React.FC<Props> = ({
  startedAt,
  minutes = 15,
  label = 'Oferta por tempo limitado. Aproveite!',
  hideOnEnd = false,
  visible = true,
}) => {
  const total = minutes * 60_000;
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, startedAt + total - Date.now()),
  );

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, startedAt + total - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, total]);

  if (!visible || (hideOnEnd && remaining <= 0)) return null;

  const secs = Math.floor(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;

  return (
    <>
      <style>{`
        @keyframes offerCountdownSlideIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes offerCountdownYellowBlink {
          0%, 100% { color: #ffffff; text-shadow: none; }
          50% { color: #facc15; text-shadow: 0 0 10px rgba(250, 204, 21, 0.85); }
        }
      `}</style>
      <div
        key={startedAt}
        className="fixed top-0 left-0 right-0 z-[90] text-white"
        style={{
          backgroundImage: 'linear-gradient(90deg, #db2777 0%, #ec4899 50%, #db2777 100%)',
          boxShadow: '0 4px 18px rgba(219,39,119,0.45)',
          paddingTop: 'env(safe-area-inset-top)',
          animation: 'offerCountdownSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
          willChange: 'transform, opacity',
        }}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-3 py-2 text-center">
          <span
            className="text-[12px] sm:text-sm font-semibold leading-tight"
            style={{ animation: 'offerCountdownYellowBlink 1.2s ease-in-out 8 both' }}
          >
            {label}
          </span>
          <span className="rounded-md bg-black/25 px-2 py-0.5 font-mono text-sm sm:text-base font-bold tabular-nums">
            {two(mm)}:{two(ss)}
          </span>
        </div>
      </div>
    </>
  );
};

export default OfferCountdownBar;
