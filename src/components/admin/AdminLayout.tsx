import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AdminSidebar } from './AdminSidebar';
import { AdminMobileNav } from './AdminMobileNav';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { UserNavbar } from '@/components/user/UserNavbar';
import { Loader2 } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, isLoading, isAdmin, isPartner } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
          <p className="mt-2 text-muted-foreground">
            Você não tem permissão para acessar o painel administrativo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: reuses user top navbar + admin bottom nav */}
      <div className="lg:hidden flex min-h-screen flex-col bg-background">
        <UserNavbar />
        <main className="flex-1 p-4 pb-24">
          <Outlet />
        </main>
        <AdminMobileNav />
      </div>

      {/* Desktop: original sidebar */}
      <div className="hidden lg:block">
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </>
  );
};
