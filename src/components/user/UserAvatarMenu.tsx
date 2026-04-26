import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

export const UserAvatarMenu: React.FC<Props> = ({ size = 'md' }) => {
  const { profile, user } = useAuth();
  const sizeClass = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const initial = (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <Link to="/app/perfil" aria-label="Meu perfil" className="rounded-full ring-2 ring-transparent hover:ring-accent transition-all">
      <Avatar className={sizeClass}>
        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Perfil'} />
        <AvatarFallback className="bg-accent/20 text-accent font-semibold">{initial}</AvatarFallback>
      </Avatar>
    </Link>
  );
};
