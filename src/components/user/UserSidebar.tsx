import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wine, Heart, GraduationCap, BookOpen, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanBadge } from '@/components/user/PlanBadge';
import { UserAvatarMenu } from '@/components/user/UserAvatarMenu';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

const navItems = [
  { icon: Wine, label: 'Receitas', href: '/app/receitas' },
  { icon: GraduationCap, label: 'Cursos', href: '/app/cursos' },
  { icon: Users, label: 'Clube', href: '/app/clube' },
  { icon: BookOpen, label: 'Ebooks', href: '/app/ebooks' },
  { icon: Heart, label: 'Favoritos', href: '/app/favoritos' },
];

export const UserSidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-card min-h-screen sticky top-0">
      <div className="flex flex-col items-center justify-center gap-3 p-6 border-b border-border">
        <UserAvatarMenu size="lg" />
        <Link to="/app/receitas">
          <img src={drinkrosLogo} alt="Drinkeros" className="h-8 object-contain" />
        </Link>
        <PlanBadge />
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.href || location.pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
