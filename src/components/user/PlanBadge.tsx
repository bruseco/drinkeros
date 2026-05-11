import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Crown } from 'lucide-react';
import { useUserPlan } from '@/hooks/useUserPlan';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  className?: string;
  /** se true, vira link pra /clube quando free */
  linkOnFree?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({ className, linkOnFree = true }) => {
  const { data } = useUserPlan();
  if (!data) return null;

  if (data.isVip) {
    const label = data.isLifetime ? 'Vitalício' : 'Clube';
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
          data.isLifetime
            ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 shadow-md shadow-amber-500/30'
            : 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-md shadow-purple-500/30',
          className
        )}
      >
        <Crown className="h-3 w-3" />
        {label}
      </span>
    );
  }

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
        'bg-lime-400 text-lime-950 shadow-sm',
        className
      )}
    >
      <Sparkles className="h-3 w-3" />
      Grátis
    </span>
  );

  return linkOnFree ? <Link to="/clube">{content}</Link> : content;
};
