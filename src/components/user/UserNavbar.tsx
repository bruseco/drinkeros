import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useUserData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Home, Heart, LogOut, GraduationCap, Trophy, BookOpen, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';

export const UserNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { data: favorites = [] } = useFavorites();

  const favoritesCount = favorites.length;

  const navItems = [
    { icon: Home, label: 'Início', href: '/app', count: 0 },
    { icon: BookOpen, label: 'Cursos', href: '/app/cursos', count: 0 },
    { icon: Heart, label: 'Rever', href: '/app/favoritos', count: favoritesCount },
    { icon: Trophy, label: 'Concluídos', href: '/app/concluidos', count: 0 },
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
            <img src={criminalLogo} alt="Criminal Lab" className="h-10 object-contain" />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-11 w-11 rounded-full p-0">
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary to-accent opacity-75" />
                  <Avatar className="relative h-10 w-10 border-2 border-card">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{profile?.full_name || 'Aluno'}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/app/cursos')}>
                <BookOpen className="mr-2 h-4 w-4" />
                Meus Cursos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/modulos')}>
                <GraduationCap className="mr-2 h-4 w-4" />
                Meus Módulos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/favoritos')} className="flex justify-between">
                <span className="flex items-center">
                  <Heart className="mr-2 h-4 w-4" />
                  Aulas para Rever
                </span>
                {favoritesCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-xs">
                    {favoritesCount}
                  </Badge>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/concluidos')}>
                <Trophy className="mr-2 h-4 w-4" />
                Concluídos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/app/perfil')}>
                <UserCircle className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
