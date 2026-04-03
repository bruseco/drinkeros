import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Wine, Heart, BookOpen, UserCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import { useAuth } from '@/contexts/AuthContext';

export const UserNavbar: React.FC = () => {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { data: favorites = [] } = useFavorites();

  const favoritesCount = favorites.length;

  const navItems = [
    { icon: Wine, label: 'Receitas', href: '/app/receitas', count: 0 },
    { icon: BookOpen, label: 'Cursos', href: '/app/cursos', count: 0 },
    { icon: FileText, label: 'Ebooks', href: '/app/ebooks', count: 0 },
    { icon: Heart, label: 'Favoritos', href: '/app/favoritos', count: favoritesCount },
    { icon: UserCircle, label: 'Perfil', href: '/app/perfil', count: 0 },
  ];

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0].toUpperCase() || 'U';
  };

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/app" className="flex items-center gap-2.5">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-10 object-contain" />
          </Link>

          <Link to="/app/perfil">
            <div className="relative h-11 w-11 rounded-full p-0">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary to-accent opacity-75" />
              <Avatar className="relative h-10 w-10 border-2 border-card">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </div>
          </Link>
        </div>
      </header>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.3)] backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-1 rounded-2xl px-5 py-2 transition-all duration-300',
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <div className="relative">
                  <item.icon 
                    className={cn(
                      "h-6 w-6 transition-transform duration-300",
                      isActive && "scale-110"
                    )} 
                  />
                  {item.count > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[10px] font-bold"
                    >
                      {item.count > 99 ? '99+' : item.count}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium transition-all duration-300",
                  isActive && "font-semibold"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
