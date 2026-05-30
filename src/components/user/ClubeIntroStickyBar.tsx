import React from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useClubeIntroOffer } from '@/hooks/useClubeIntroOffer';

/**
 * Barra fixa no topo do app exibindo countdown do desconto de R$100.
 * Aparece somente enquanto `promo.isActive` (eligível e dentro dos 30 min)
 * e a animação de reveal já tiver rodado (hasRevealed).
 */
export const ClubeIntroStickyBar: React.FC = () => {
  const { isActive, mm, ss, hasRevealed } = useClubeIntroOffer();
  if (!isActive || !hasRevealed) return null;

  return (
    <div
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
        <span className="tabular-nums">{mm}:{ss}</span>
      </Link>
    </div>
  );
};

export default ClubeIntroStickyBar;
