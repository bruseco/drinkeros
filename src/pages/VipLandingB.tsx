import React from 'react';
import VipLanding from './VipLanding';
import { useAbVariantTrack } from '@/hooks/useAbTest';

/**
 * Variante B do /clube (teste A/B).
 *
 * Por enquanto este arquivo apenas reaproveita VipLanding — o teste só fará
 * sentido depois que você pedir "duplica o conteúdo de VipLanding aqui e
 * altera X, Y, Z na variante B". A partir desse momento, este componente
 * vira uma cópia editável e independente.
 *
 * O hook abaixo registra a visita da variante B e fixa o cookie do visitante.
 */
const VipLandingB: React.FC = () => {
  useAbVariantTrack('clube', 'b');
  return <VipLanding />;
};

export default VipLandingB;
