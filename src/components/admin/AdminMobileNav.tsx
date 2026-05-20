import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, BookOpen, FileText, Wine, ShoppingBag, UserCog, ShoppingCart, Users, Mail, Bell,
  Rocket, MessageCircle, ClipboardCheck, Clock, Target, BarChart3, Activity, LineChart, Tag, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const primaryItems = [
  { title: 'Dashboard', icon: Home, href: '/admin' },
  { title: 'Cursos', icon: BookOpen, href: '/admin/cursos' },
  { title: 'E-books', icon: FileText, href: '/admin/ebooks' },
  { title: 'Receitas', icon: Wine, href: '/admin/receitas' },
];

const moreItems = [
  { title: 'Pacotes', icon: ShoppingBag, href: '/admin/produtos' },
  { title: 'Usuários', icon: UserCog, href: '/admin/users' },
  { title: 'Vendas', icon: ShoppingCart, href: '/admin/pedidos' },
  { title: 'NIBO (NF-e)', icon: FileText, href: '/admin/nibo' },
  { title: 'Equipe', icon: Users, href: '/admin/team' },
  { title: 'Email', icon: Mail, href: '/admin/configuracoes' },
  { title: 'Notificações', icon: Bell, href: '/admin/notificacoes' },
  { title: 'Máquina de Ascensão', icon: Rocket, href: '/admin/upsell' },
  { title: 'WhatsApp', icon: MessageCircle, href: '/admin/whatsapp' },
  { title: 'Agente CS', icon: ClipboardCheck, href: '/admin/cs-reports' },
  { title: 'Timeline CS', icon: Clock, href: '/admin/cs-timeline' },
  { title: 'CRM', icon: Target, href: '/admin/crm' },
  { title: 'Métricas UX', icon: BarChart3, href: '/admin/ux-metrics' },
  { title: 'Métricas de Acesso', icon: Activity, href: '/admin/metricas-acesso' },
  { title: 'Tracking', icon: LineChart, href: '/admin/metricas' },
  { title: 'Páginas de Venda', icon: Tag, href: '/admin/paginas-venda' },
  { title: 'Checklist de Postagens', icon: ClipboardCheck, href: '/admin/checklist-postagens' },
];

export const AdminMobileNav: React.FC = () => {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/admin'
      ? location.pathname === '/admin'
      : location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.3)] backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden pb-[7px]">
      <div className="flex items-center justify-around py-2 px-2">
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 transition-all duration-300',
                active ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-6 w-6 transition-transform duration-300', active && 'scale-110')} />
              <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>{item.title}</span>
            </Link>
          );
        })}

        {isSuperAdmin && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative flex flex-col items-center gap-1 px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-300"
                aria-label="Mais opções"
              >
                <MoreHorizontal className="h-6 w-6" />
                <span className="text-[10px] font-medium">Mais</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader className="mb-4">
                <SheetTitle>Administração</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 pb-8">
                {moreItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors',
                        active ? 'border-accent text-accent' : 'text-foreground hover:bg-accent/10'
                      )}
                    >
                      <item.icon className="h-6 w-6" />
                      <span className="text-[11px] font-medium leading-tight">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
};
