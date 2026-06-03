import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserNavbar } from './UserNavbar';
import { UserSidebar } from './UserSidebar';
import { PushNotificationPrompt } from './PushNotificationPrompt';
import { PageTransition } from './PageTransition';
import { WinnerPopup } from './WinnerPopup';
import { PwaInstallGate } from './PwaInstallGate';
import { PwaSplashScreen } from './PwaSplashScreen';
import { VipDiscountCountdownBanner } from './VipDiscountCountdownBanner';
import { WelcomeOverlay } from './WelcomeOverlay';
import ClubeIntroStickyBar from './ClubeIntroStickyBar';
import ClubeRetriggerWatcher from './ClubeRetriggerWatcher';


import { Loader2 } from 'lucide-react';

export const UserLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [phoneCheck, setPhoneCheck] = useState<'pending' | 'ok' | 'missing'>('pending');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setPhoneCheck(data?.phone ? 'ok' : 'missing');
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (isLoading || (user && phoneCheck === 'pending')) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (phoneCheck === 'missing') {
    return <Navigate to="/complete-profile" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <ClubeIntroStickyBar />
      <ClubeRetriggerWatcher />
      <WelcomeOverlay />

      <PwaSplashScreen />
      <UserSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <PwaInstallGate />
        <VipDiscountCountdownBanner />
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
