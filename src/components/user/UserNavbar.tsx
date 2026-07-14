import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wine, Heart, GraduationCap, BookOpen, ArrowLeft, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import { Button } from '@/components/ui/button';
import { UserAvatarMenu } from '@/components/user/UserAvatarMenu';

const mainRoutes = ['/app/receitas', '/app/cursos', '/app/clube', '/app/ebooks', '/app/favoritos', '/app/perfil'];

export const UserNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isInternalPage = !mainRoutes.includes(location.pathname);
  const isRecipesListPage = location.pathname === '/app/receitas';

  const navItems = [
    { icon: Wine, label: 'Receitas', href: '/app/receitas' },
    { icon: GraduationCap, label: 'Cursos', href: '/app/cursos' },
    { icon: MessagesSquare, label: 'Clube', href: '/app/clube' },
    { icon: BookOpen, label: 'Ebooks', href: '/app/ebooks' },
    { icon: Heart, label: 'Favoritos', href: '/app/favoritos' },
  ];


  return (
    <>
      <header
        className={cn(
          'z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 lg:hidden',
          !isRecipesListPage && 'sticky'
        )}
        style={!isRecipesListPage ? { top: 'var(--top-banner-h, 0px)' } : undefined}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 relative">
          <div className="flex items-center gap-2">
            {isInternalPage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-9 w-9 rounded-full"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
          </div>
          <Link to="/app/receitas" className="absolute left-1/2 -translate-x-1/2">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-10 object-contain" />
          </Link>
          <UserAvatarMenu size="sm" />
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.3)] backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden pb-[7px]">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            const inner = (
              <>
                <item.icon className={cn("h-6 w-6 transition-transform duration-300", isActive && "scale-110")} />

                <span className={cn("text-[10px] font-medium transition-all duration-300", isActive && "font-semibold")}>
                  {item.label}
                </span>
              </>
            );



            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={(e) => {
                  if (location.pathname === item.href) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2 transition-all duration-300',
                  isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
