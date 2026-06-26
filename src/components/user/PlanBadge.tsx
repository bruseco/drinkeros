import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Crown, GraduationCap } from 'lucide-react';
import { useUserPlan } from '@/hooks/useUserPlan';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  className?: string;
  /** Se true, vira link para /pv-clube quando Grátis (default: true) */
  linkOnFree?: boolean;
  /** Se true, vira link para /pv-clube quando Aluno (upsell para Sócio) (default: true) */
  linkOnAluno?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({
  className,
  linkOnFree = true,
  linkOnAluno = true,
}) => {
  const { data } = useUserPlan();
  if (!data) return null;

  const baseClasses =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide';

  // Vitalício
  if (data.isLifetime) {
    return (
      <span
        className={cn(
          baseClasses,
          'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 shadow-md shadow-amber-500/30',
          className
        )}
      >
        <Crown className="h-3 w-3" />
        Vitalício
      </span>
    );
  }

  // Sócio
  if (data.isSocio) {
    return (
      <span
        className={cn(
          baseClasses,
          'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-md shadow-purple-500/30',
          className
        )}
      >
        <Crown className="h-3 w-3" />
        Sócio
      </span>
    );
  }

  // Aluno (compras avulsas, sem assinatura)
  if (data.isAluno) {
    const content = (
      <span
        className={cn(
          baseClasses,
          'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md shadow-sky-500/30',
          className
        )}
      >
        <GraduationCap className="h-3 w-3" />
        Aluno
      </span>
    );
    return linkOnAluno ? <Link to="/pv-clube">{content}</Link> : content;
  }

  // Grátis (default)
  const content = (
    <span className={cn(baseClasses, 'bg-lime-400 text-lime-950 shadow-sm', className)}>
      <Sparkles className="h-3 w-3" />
      Grátis
    </span>
  );

  return linkOnFree ? <Link to="/pv-clube">{content}</Link> : content;
};
