import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserNavbar } from './UserNavbar';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { PageTransition } from './PageTransition';

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
    <div className="flex min-h-screen flex-col bg-background">
      <UserNavbar />
      <PushNotificationPrompt />
      <main className="flex-1 pb-20 overflow-x-hidden">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
};
