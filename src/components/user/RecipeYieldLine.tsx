import React from 'react';
import { Droplet, Wine, Users } from 'lucide-react';

interface Props {
  yieldMl?: number | null;
  drinksCount?: number | null;
  servesPeople?: number | null;
}

function formatVolume(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000;
    // 1 casa decimal, vírgula como separador
    const formatted = liters.toFixed(1).replace('.', ',');
    // remove ",0" se for número redondo
    return `${formatted.endsWith(',0') ? formatted.slice(0, -2) : formatted} L`;
  }
  return `${Math.round(ml)} ml`;
}

/**
 * Mostra o rendimento abaixo do título da receita.
 * Regra: só aparece quando a receita rende MAIS de 1 drink.
 * Em receitas unitárias (1 copo) não exibe nada.
 */
export const RecipeYieldLine: React.FC<Props> = ({ yieldMl, drinksCount, servesPeople }) => {
  // Só mostra para receitas batch (mais de 1 drink)
  if (!drinksCount || drinksCount <= 1) return null;

  const parts: Array<{ icon: React.ReactNode; label: string }> = [];

  if (yieldMl && yieldMl > 0) {
    parts.push({ icon: <Droplet className="h-4 w-4" />, label: formatVolume(yieldMl) });
  }
  parts.push({ icon: <Wine className="h-4 w-4" />, label: `${drinksCount} Drinks` });
  if (servesPeople && servesPeople > 0) {
    parts.push({
      icon: <Users className="h-4 w-4" />,
      label: `Serve até ${servesPeople} ${servesPeople === 1 ? 'pessoa' : 'pessoas'}`,
    });
  }

  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-green-500">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {p.icon}
          {p.label}
        </span>
      ))}
    </div>
  );
};

export default RecipeYieldLine;
