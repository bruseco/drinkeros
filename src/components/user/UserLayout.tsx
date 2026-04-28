import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserNavbar } from './UserNavbar';
import { UserSidebar } from './UserSidebar';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { PageTransition } from './PageTransition';
import { WinnerPopup } from './WinnerPopup';
import { PwaInstallGate } from './PwaInstallGate';

import { Loader2 } from 'lucide-react';

export const UserLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <UserSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <PwaInstallGate />
        <UserNavbar />
        <PushNotificationPrompt />
        <WinnerPopup />
        <main className="flex-1 pb-20 lg:pb-0">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
};
