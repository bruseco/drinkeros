import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

export const UserAvatarMenu: React.FC<Props> = ({ size = 'md' }) => {
  const { profile, user } = useAuth();
  const { missingCount, missingFields } = useProfileCompleteness();
  const sizeClass = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const initial = (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <Link
      to="/app/perfil"
      aria-label={
        missingCount > 0
          ? `Meu perfil — ${missingCount} dados faltando: ${missingFields.join(', ')}`
          : 'Meu perfil'
      }
      className="relative rounded-full ring-2 ring-transparent hover:ring-accent transition-all"
    >
      <Avatar className={sizeClass}>
        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Perfil'} />
        <AvatarFallback className="bg-accent/20 text-accent font-semibold">{initial}</AvatarFallback>
      </Avatar>
      {missingCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background animate-pulse"
          aria-hidden="true"
        >
          {missingCount}
        </span>
      )}
    </Link>
  );
};
