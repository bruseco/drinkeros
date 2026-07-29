import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { GraduationCap, Play, Users, UserCog, LogOut, Home, Mail, Bell, BookOpen, Rocket, MessageCircle, Layers, ClipboardCheck, Clock, Target, BarChart3, FileText, ShoppingBag, Wine, Tag, ShoppingCart, Activity, LineChart } from 'lucide-react';
import drinkrosLogo from '@/assets/logotipo-drinkeros.png';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Dashboard', icon: Home, href: '/admin' },
  { title: 'Cursos', icon: BookOpen, href: '/admin/cursos' },
  { title: 'E-books', icon: FileText, href: '/admin/ebooks' },
  { title: 'Receitas', icon: Wine, href: '/admin/receitas' },
  { title: 'Pacotes', icon: ShoppingBag, href: '/admin/produtos' },
];

const adminItems = [
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

export const AdminSidebar: React.FC = () => {
  const { user, profile, signOut, isSuperAdmin, isAdmin, isPartner } = useAuth();
  const location = useLocation();
  const partnerOnly = isPartner && !isAdmin;
  const visibleMenuItems = partnerOnly
    ? [{ title: 'Vendas', icon: ShoppingCart, href: '/admin/pedidos' }]
    : menuItems;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link to="/admin" className="flex items-center justify-center">
          <img src={drinkrosLogo} alt="Drinkeros" className="h-12" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href || location.pathname.startsWith(item.href + '/')}
                  >
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.href}
                    >
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">
              {profile?.full_name || user?.email}
            </span>
            <span className="text-xs text-muted-foreground">{user?.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
