import React from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useClubeIntroOffer, useIntroCountdown } from '@/hooks/useClubeIntroOffer';

/**
 * Barra fixa no topo do app exibindo countdown do desconto de R$100.
 * O tick de 1s fica isolado em um componente filho para não re-renderizar
 * a árvore inteira do app a cada segundo.
 */
const Countdown: React.FC<{ untilMs: number }> = ({ untilMs }) => {
  const { mm, ss } = useIntroCountdown(untilMs);
  return <span className="tabular-nums font-black text-yellow-300">{mm}:{ss}</span>;
};

export const ClubeIntroStickyBar: React.FC = () => {
  const { isActive, eligibleUntilMs, hasRevealed } = useClubeIntroOffer();
  const barRef = React.useRef<HTMLDivElement>(null);
  const visible = isActive && hasRevealed;

  // Mede a altura real da barra (inclui safe-area) e expõe como --top-banner-h
  // para que o body ganhe padding-top equivalente e nada fique coberto.
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty('--top-banner-h');
      root.classList.remove('has-top-banner');
      return;
    }
    const apply = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      root.style.setProperty('--top-banner-h', `${h}px`);
      root.classList.add('has-top-banner');
    };
    apply();
    const ro = new ResizeObserver(apply);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--top-banner-h');
      root.classList.remove('has-top-banner');
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 top-0 z-[190]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Link
        to="/clube-b#clube-pricing"
        className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold text-black"
        style={{
          backgroundImage:
            'linear-gradient(90deg, #f5d76e 0%, #f1c40f 50%, #c69214 100%)',
          boxShadow: '0 4px 16px rgba(241,196,15,0.35)',
        }}
      >
        <Crown className="h-4 w-4" />
        <span className="hidden sm:inline">Desconto R$100 ativo · Sócio do Clube por</span>
        <span className="sm:hidden">R$100 OFF · Clube por</span>
        <span className="font-black tabular-nums">R$97</span>
        <span className="opacity-80">·</span>
        <Countdown untilMs={eligibleUntilMs} />
      </Link>
    </div>
  );
};

export default ClubeIntroStickyBar;
