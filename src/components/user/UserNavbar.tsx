import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wine, Heart, GraduationCap, UserCircle, BookOpen, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import { Button } from '@/components/ui/button';

// Main tab routes (no back button needed)
const mainRoutes = ['/app', '/app/receitas', '/app/cursos', '/app/ebooks', '/app/favoritos', '/app/perfil'];

export const UserNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isInternalPage = !mainRoutes.includes(location.pathname);

  const navItems = [
    { icon: Wine, label: 'Receitas', href: '/app/receitas' },
    { icon: GraduationCap, label: 'Cursos', href: '/app/cursos' },
    { icon: BookOpen, label: 'Ebooks', href: '/app/ebooks' },
    { icon: Heart, label: 'Favoritos', href: '/app/favoritos' },
    { icon: UserCircle, label: 'Perfil', href: '/app/perfil' },
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-center px-4 relative">
          {isInternalPage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="absolute left-4 h-9 w-9 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Link to="/app">
            <img src={drinkrosLogo} alt="Drinkeros" className="h-10 object-contain" />
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
                  'relative flex flex-col items-center gap-1 px-5 py-2 transition-all duration-300',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <item.icon 
                    className={cn(
                      "h-6 w-6 transition-transform duration-300",
                      isActive && "scale-110"
                    )} 
                  />
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